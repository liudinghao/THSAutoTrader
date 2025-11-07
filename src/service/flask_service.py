from flask import Flask, request, jsonify, render_template, Response
from flask_cors import CORS
import threading
from src.util.logger import Logger
import time
import os
import sys
import ctypes
import requests
import urllib3
from src.service.window_service import WindowService

# 禁用SSL证书验证警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class FlaskApp:
    def __init__(self, host='0.0.0.0', port=5000, controller=None):
        """
        初始化Flask应用
        Args:
            host (str): 监听地址，默认localhost
            port (int): 监听端口，默认5000
        """
        self.host = host
        self.port = port
        self.controller = controller
        self.window_service = WindowService()
        self.app = Flask(__name__,
                template_folder=self.resource_path('html'),
                static_folder=self.resource_path('html'))
        self.running = False
        self.thread = None
        self.logger = Logger.get_instance()
        
        # 配置CORS
        CORS(self.app)
        
        # 设置JSON编码
        self.app.config['JSON_AS_ASCII'] = False
        # 默认路由
        @self.app.route('/')
        def default_route():
            return render_template('index.html', name="访客")
        
        self._register_routes()

    def add_route(self, path, handler, methods=['GET']):
        """
        添加路由
        Args:
            path (str): 请求路径
            handler (callable): 处理函数
            methods (list): 支持的HTTP方法
        """
        def wrapper():
            # 处理请求数据
            data = None
            if request.method in ['POST', 'PUT']:
                if request.is_json:
                    data = request.get_json()
                else:
                    data = request.data
            
            # 调用处理函数并返回响应
            result = handler(data)
            return jsonify(result)
        
        # 注册路由
        self.app.add_url_rule(
            path,
            endpoint=path,
            view_func=wrapper,
            methods=methods
        )

    def run(self):
        """启动Flask服务器"""
        if not self.running:
            self._run_server()
            self.running = True

    def run_async(self):
        """异步启动服务器"""
        if not self.running:
            self.thread = threading.Thread(target=self.run)
            self.thread.daemon = True
            self.thread.start()
            self.running = True

    def stop(self):
        """停止服务器（需要自行实现关闭逻辑）"""
        # Flask开发服务器没有原生停止方法，通常通过发送中断信号
        self.running = False
        print("请使用Ctrl+C停止服务器")

    def _run_server(self):
        try:
            # 添加更详细的启动日志
            self.logger.add_log(f"HTTP服务初始化完成，监听地址：{self.host}:{self.port}")
            self.app.run(host=self.host, port=self.port, debug=False, use_reloader=False)
        except Exception as e:
            self.logger.add_log(f"HTTP服务启动失败: {str(e)}")
            raise  # 抛出异常以便上层捕获
    def resource_path(self, relative_path):
        """获取打包后的资源路径"""
        base_path = os.path.abspath(".")

        return os.path.join(base_path, relative_path)

    def _register_routes(self):
        # 基础健康检查
        @self.app.route('/health', methods=['GET'])
        def health_check():
            return jsonify({"status": "success", "timestamp": time.time()})
        
        # 获取资金余额
        @self.app.route('/balance', methods=['GET'])
        def get_balance():
            try:
                # 调用controller获取资金余额
                balance = self.controller.get_balance()
                return jsonify({
                    "status": "success",
                    "data": balance
                })
            except Exception as e:
                self.logger.add_log(f"获取资金余额失败: {str(e)}")
                return jsonify({
                    "status": "error",
                    "message": f"获取资金余额失败: {str(e)}"
                }), 500
        
        # 获取持仓信息
        @self.app.route('/position', methods=['GET'])
        def get_position():
            try:
                # 调用controller获取持仓信息
                position = self.controller.get_position()
                return jsonify({
                    "status": "success",
                    "data": position
                })
            except Exception as e:
                self.logger.add_log(f"获取持仓失败: {str(e)}")
                return jsonify({
                    "status": "error",
                    "message": f"获取持仓失败: {str(e)}"
                }), 500
        
        # 鼠标点击
        @self.app.route('/click', methods=['GET'])
        def click():
            try:
                self.controller.handle_click()
                return jsonify({"status": "success", "message": "下单成功"})
            except Exception as e:
                self.logger.add_log(f"下单异常: {str(e)}")
                return jsonify({"status": "error", "message": f"下单异常: {str(e)}"}), 500
        
        # send_key
        @self.app.route('/send_key', methods=['GET'])
        def send_key():
            # 从url上获取参数，key
            key = request.args.get('key')
            try:
                # 先激活窗口
                self.controller.handle_activate_window()
                time.sleep(0.1)
                self.window_service.send_key(key)
                time.sleep(0.1)
                return jsonify({"status": "success", "message": f"已发送按键 {key}"})
            except Exception as e:
                self.logger.add_log(f"按键发送失败: {str(e)}")
                return jsonify({"status": "error", "message": f"按键发送失败: {str(e)}"})
        
        # 下单点击
        @self.app.route('/xiadan', methods=['GET'])
        def xiadan():
            # 从url上获取参数，code
            code = request.args.get('code')
            status = request.args.get('status')
            amount = request.args.get('amount')
            try:
                if code is None:
                    return jsonify({"status": "error", "message": "code不能为空"})
                if status is None:
                    return jsonify({"status": "error", "message": "status不能为空,1:闪电买入,2:闪电卖出"})
                # 先激活窗口
                self.controller.handle_activate_window()
                time.sleep(0.1)
                # 发送代码
                keyStr = code + ' ENTER '
                if status == '1':
                    keyStr = keyStr + '21 ENTER'
                elif status == '2':
                    keyStr = keyStr + '23 ENTER'

                self.window_service.send_key(keyStr)
                # 获取window
                window = self.window_service.get_target_window({'class_name': '#32770', 'title':''})
                # 如果有amount参数
                if amount:
                    self.window_service.input_text_to_element(window, 1034, amount)
                
                # 下单点击
                self.window_service.click_element(window, 1006)
                return jsonify({"status": "success", "message": f"已发送按键 {keyStr}"})
            except Exception as e:
                self.logger.add_log(f"按键发送失败: {str(e)}")
                return jsonify({"status": "error", "message": f"下单异常: {str(e)}"})
               
        # 撤销所有委托
        @self.app.route('/cancel_all_orders', methods=['GET'])
        def cancel_all_orders():
            try:
                result = self.controller.handle_cancel_all_orders()
                if result:
                    return jsonify({"status": "success", "message": "批量撤单操作已执行"})
                else:
                    return jsonify({"status": "error", "message": "批量撤单失败"})
            except Exception as e:
                self.logger.add_log(f"批量撤单失败: {str(e)}")
                return jsonify({"status": "error", "message": f"批量撤单失败: {str(e)}"})

        # 通用代理接口
        @self.app.route('/proxy/<path:url>', methods=['GET', 'POST', 'PUT', 'DELETE'])
        def proxy(url):
            """
            通用代理接口,转发请求到目标服务器
            前端调用: http://localhost:5000/proxy/basic.10jqka.com.cn/mapp/300033/stock_base_info.json
            实际转发: https://basic.10jqka.com.cn/mapp/300033/stock_base_info.json
            """
            try:
                # 构建目标URL - 默认使用https协议
                target_url = f"https://{url}"

                # 保留原始查询参数
                if request.query_string:
                    target_url += f"?{request.query_string.decode('utf-8')}"

                # 准备请求头,直接使用客户端传来的请求头,仅移除Host头避免冲突
                headers = {key: value for key, value in request.headers if key.lower() != 'host'}

                # 根据请求方法转发
                if request.method == 'GET':
                    resp = requests.get(target_url, headers=headers, timeout=10, verify=False)
                elif request.method == 'POST':
                    resp = requests.post(target_url, headers=headers, data=request.get_data(), timeout=10, verify=False)
                elif request.method == 'PUT':
                    resp = requests.put(target_url, headers=headers, data=request.get_data(), timeout=10, verify=False)
                elif request.method == 'DELETE':
                    resp = requests.delete(target_url, headers=headers, timeout=10, verify=False)

                # 记录日志
                self.logger.add_log(f"代理请求成功: {target_url} -> {resp.status_code}")

                # 构建响应头,排除某些不应该转发的头
                excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
                response_headers = [(name, value) for name, value in resp.raw.headers.items()
                                   if name.lower() not in excluded_headers]

                # 返回代理响应
                return Response(resp.content, resp.status_code, response_headers)

            except requests.exceptions.Timeout:
                self.logger.add_log(f"代理请求超时: {url}")
                return jsonify({"status": "error", "message": "请求超时"}), 504
            except requests.exceptions.RequestException as e:
                self.logger.add_log(f"代理请求失败: {url}, 错误: {str(e)}")
                return jsonify({"status": "error", "message": f"代理请求失败: {str(e)}"}), 500
            except Exception as e:
                self.logger.add_log(f"代理处理异常: {url}, 错误: {str(e)}")
                return jsonify({"status": "error", "message": f"代理处理异常: {str(e)}"}), 500

        # 通用静态资源路由
        @self.app.route('/<path:filename>')
        def static_files(filename):
            try:
                return self.app.send_static_file(filename)
            except Exception as e:
                self.logger.add_log(f"静态文件请求失败: {filename}, 错误: {str(e)}")
                return jsonify({"status": "error", "message": "文件未找到"}), 404
            