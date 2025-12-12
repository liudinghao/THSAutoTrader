"""
高性能代理服务
负责转发HTTP请求到目标服务器,支持连接池复用和缓存

性能优化:
1. 连接池复用 - 避免重复TCP/SSL握手
2. 内存缓存 - GET请求结果缓存
3. 自动重试 - 失败自动重试提升成功率
4. 线程安全 - 支持多线程并发请求
"""

import requests
import urllib3
import threading
from datetime import datetime, timedelta
from flask import request, Response, jsonify
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from src.util.logger import Logger

# 禁用SSL证书验证警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class ProxyService:
    """代理服务类 - 负责HTTP请求转发"""

    def __init__(self, cache_ttl=10, pool_connections=100, pool_maxsize=200, max_retries=3):
        """
        初始化代理服务

        Args:
            cache_ttl (int): 缓存过期时间(秒),默认10秒
            pool_connections (int): 每个host的连接池数量,默认100
            pool_maxsize (int): 最大并发连接数,默认200
            max_retries (int): 失败重试次数,默认3次
        """
        self.logger = Logger.get_instance()
        self.cache_ttl = cache_ttl

        # 创建高性能的requests session
        self.session = requests.Session()

        # 配置重试策略 - 自动重试提升成功率
        retry_strategy = Retry(
            total=max_retries,                    # 总共重试次数
            backoff_factor=0.3,                   # 重试间隔: {backoff factor} * (2 ** (重试次数 - 1))
            status_forcelist=[429, 500, 502, 503, 504],  # 这些状态码会重试
            allowed_methods=["HEAD", "GET", "PUT", "DELETE", "OPTIONS", "TRACE", "POST"]  # 允许POST重试
        )

        # 配置HTTPAdapter连接池 - 大幅提升并发能力!
        adapter = HTTPAdapter(
            pool_connections=pool_connections,   # 增加到100
            pool_maxsize=pool_maxsize,          # 增加到200
            max_retries=retry_strategy,         # 启用重试
            pool_block=False                    # 池满时不阻塞,直接失败
        )
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)
        self.session.verify = False

        # 设置默认请求头 - 减少每次请求的开销
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        })

        # 内存缓存 - 使用线程锁保证线程安全
        self.response_cache = {}
        self.cache_lock = threading.RLock()  # 可重入锁,避免死锁

        # 统计信息
        self.stats = {
            'total_requests': 0,
            'cache_hits': 0,
            'failed_requests': 0,
            'retried_requests': 0
        }
        self.stats_lock = threading.Lock()

    def _get_cache_key(self, url, method):
        """生成缓存键"""
        return f"{method}:{url}"

    def _get_from_cache(self, cache_key):
        """
        从缓存获取响应 - 线程安全

        Returns:
            dict or None: 缓存的响应数据,如果不存在或已过期返回None
        """
        with self.cache_lock:
            if cache_key in self.response_cache:
                cached_data, timestamp = self.response_cache[cache_key]
                # 检查是否过期
                if datetime.now() - timestamp < timedelta(seconds=self.cache_ttl):
                    # 更新统计
                    with self.stats_lock:
                        self.stats['cache_hits'] += 1
                    return cached_data
                else:
                    # 删除过期缓存
                    del self.response_cache[cache_key]
            return None

    def _set_to_cache(self, cache_key, data):
        """
        设置缓存 - 线程安全

        Args:
            cache_key (str): 缓存键
            data (dict): 要缓存的数据
        """
        with self.cache_lock:
            self.response_cache[cache_key] = (data, datetime.now())

            # 简单的缓存清理:如果缓存项超过1000个,清空一半
            if len(self.response_cache) > 1000:
                keys_to_delete = list(self.response_cache.keys())[:500]
                for key in keys_to_delete:
                    del self.response_cache[key]

    def clear_cache(self):
        """清空所有缓存 - 线程安全"""
        with self.cache_lock:
            self.response_cache.clear()

    def get_stats(self):
        """
        获取统计信息 - 包括缓存和请求统计

        Returns:
            dict: 统计数据
        """
        with self.cache_lock:
            cache_size = len(self.response_cache)

        with self.stats_lock:
            stats = self.stats.copy()

        stats['cache_size'] = cache_size
        stats['cache_ttl_seconds'] = self.cache_ttl

        # 计算缓存命中率
        if stats['total_requests'] > 0:
            stats['cache_hit_rate'] = f"{stats['cache_hits'] / stats['total_requests'] * 100:.2f}%"
        else:
            stats['cache_hit_rate'] = "0%"

        return stats

    def proxy_request(self, url, flask_request):
        """
        代理HTTP请求 - 线程安全,支持重试

        Args:
            url (str): 目标URL路径(不含协议和域名)
            flask_request: Flask的request对象

        Returns:
            Response: Flask响应对象
        """
        # 更新统计
        with self.stats_lock:
            self.stats['total_requests'] += 1

        try:
            # 构建目标URL - 默认使用https协议
            target_url = f"https://{url}"
            if flask_request.query_string:
                target_url += f"?{flask_request.query_string.decode('utf-8')}"

            # 对于GET请求,优先从缓存获取
            if flask_request.method == 'GET':
                cache_key = self._get_cache_key(target_url, 'GET')
                cached_response = self._get_from_cache(cache_key)
                if cached_response:
                    # 缓存命中!直接返回,几乎零延迟
                    return Response(
                        cached_response['content'],
                        status=cached_response['status'],
                        headers=cached_response['headers']
                    )

            # 准备请求头 - 只排除会冲突的头
            excluded_headers = {'host', 'content-length', 'transfer-encoding'}
            headers = {k: v for k, v in flask_request.headers
                      if k.lower() not in excluded_headers}

            # 使用session转发请求 - 自动复用连接,自动重试
            resp = self.session.request(
                method=flask_request.method,
                url=target_url,
                headers=headers,
                data=flask_request.get_data() if flask_request.method in ['POST', 'PUT', 'PATCH'] else None,
                timeout=(3, 10),  # (连接超时, 读取超时) - 更合理的超时设置
                stream=False      # 直接获取完整响应
            )

            # 检查是否发生了重试
            if hasattr(resp, 'history') and len(resp.history) > 0:
                with self.stats_lock:
                    self.stats['retried_requests'] += 1

            # 只在出错时记录日志
            if resp.status_code >= 400:
                with self.stats_lock:
                    self.stats['failed_requests'] += 1
                self.logger.add_log(f"代理失败: {target_url} -> {resp.status_code}")

            # 构建响应头 - 排除会导致问题的头
            excluded_response_headers = {'content-encoding', 'content-length', 'transfer-encoding'}
            response_headers = {
                k: v for k, v in resp.headers.items()
                if k.lower() not in excluded_response_headers
            }

            # 对于GET请求的成功响应,缓存起来
            if flask_request.method == 'GET' and resp.status_code == 200:
                cache_key = self._get_cache_key(target_url, 'GET')
                self._set_to_cache(cache_key, {
                    'content': resp.content,
                    'status': resp.status_code,
                    'headers': response_headers
                })

            # 直接返回响应
            return Response(
                resp.content,
                status=resp.status_code,
                headers=response_headers
            )

        except requests.exceptions.Timeout:
            with self.stats_lock:
                self.stats['failed_requests'] += 1
            self.logger.add_log(f"代理超时: {url}")
            return jsonify({"status": "error", "message": "请求超时"}), 504
        except requests.exceptions.ConnectionError as e:
            with self.stats_lock:
                self.stats['failed_requests'] += 1
            self.logger.add_log(f"代理连接失败: {url}, 错误: {str(e)}")
            return jsonify({"status": "error", "message": "连接失败,请检查网络"}), 502
        except requests.exceptions.RequestException as e:
            with self.stats_lock:
                self.stats['failed_requests'] += 1
            self.logger.add_log(f"代理失败: {url}, 错误: {str(e)}")
            return jsonify({"status": "error", "message": f"代理失败: {str(e)}"}), 502
        except Exception as e:
            with self.stats_lock:
                self.stats['failed_requests'] += 1
            self.logger.add_log(f"代理异常: {url}, 错误: {str(e)}")
            return jsonify({"status": "error", "message": f"代理异常: {str(e)}"}), 500

    def close(self):
        """关闭session,释放资源"""
        self.session.close()
