import threading
import time
import win32gui
import win32con
import win32process
import psutil
from src.util.logger import Logger


class WindowMonitor:
    """
    窗口监控服务
    监控目标窗口是否最小化，如果最小化则自动恢复到前台
    """

    def __init__(self, check_interval: float = 5):
        """
        初始化窗口监控器
        :param check_interval: 检查间隔（秒），默认5秒
        """
        self.logger = Logger()
        self.check_interval = check_interval
        self._running = False
        self._monitor_thread = None
        self._target_app_path = None
        self._target_hwnd = None
        self._lock = threading.Lock()

    def start(self, app_path: str) -> bool:
        """
        启动监控
        :param app_path: 目标应用程序路径
        :return: 是否启动成功
        """
        with self._lock:
            if self._running:
                self.logger.add_log("窗口监控已在运行中")
                return False

            self._target_app_path = app_path
            self._running = True

            self._monitor_thread = threading.Thread(
                target=self._monitor_loop,
                daemon=True,
                name="Window-Monitor"
            )
            self._monitor_thread.start()
            self.logger.add_log(f"窗口监控已启动，目标程序: {app_path}")
            return True

    def stop(self):
        """停止监控"""
        with self._lock:
            if not self._running:
                return

            self._running = False
            self._target_hwnd = None
            self.logger.add_log("窗口监控已停止")

    def is_running(self) -> bool:
        """检查监控是否正在运行"""
        return self._running

    def _find_target_window(self) -> int:
        """
        查找目标窗口句柄
        :return: 窗口句柄，未找到返回None
        """
        hwnd_found = None
        target_path = self._target_app_path.lower() if self._target_app_path else None

        def callback(hwnd, extra):
            nonlocal hwnd_found
            if win32gui.IsWindowVisible(hwnd):
                try:
                    _, pid = win32process.GetWindowThreadProcessId(hwnd)
                    proc = psutil.Process(pid)
                    if proc.exe().lower() == target_path:
                        hwnd_found = hwnd
                        return False  # 停止枚举
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            return True

        if target_path:
            win32gui.EnumWindows(callback, None)

        return hwnd_found

    def _restore_window(self, hwnd: int) -> bool:
        """
        恢复最小化的窗口
        :param hwnd: 窗口句柄
        :return: 是否恢复成功
        """
        try:
            # 检查窗口是否有效
            if not win32gui.IsWindow(hwnd):
                self.logger.add_log("窗口句柄无效，尝试重新查找")
                return False

            # 恢复最小化的窗口
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            time.sleep(0.1)

            # 尝试将窗口置于前台
            try:
                win32gui.SetForegroundWindow(hwnd)
            except Exception as e:
                # SetForegroundWindow 可能因为权限问题失败
                # 使用备用方案
                self._force_foreground(hwnd)

            self.logger.add_log("已自动恢复最小化窗口")
            return True

        except Exception as e:
            self.logger.add_log(f"恢复窗口失败: {str(e)}")
            return False

    def _force_foreground(self, hwnd: int):
        """
        强制将窗口置于前台（备用方案）
        :param hwnd: 窗口句柄
        """
        try:
            # 先最小化再恢复，可以绕过一些限制
            win32gui.ShowWindow(hwnd, win32con.SW_MINIMIZE)
            time.sleep(0.05)
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        except Exception as e:
            self.logger.add_log(f"强制前台失败: {str(e)}")

    def _monitor_loop(self):
        """监控循环"""
        self.logger.add_log("窗口监控线程已启动")
        consecutive_failures = 0

        while self._running:
            try:
                # 查找目标窗口
                hwnd = self._find_target_window()

                if hwnd is None:
                    consecutive_failures += 1
                    if consecutive_failures >= 5:
                        self.logger.add_log("连续5次未找到目标窗口，请检查程序是否已启动")
                        consecutive_failures = 0
                else:
                    consecutive_failures = 0
                    self._target_hwnd = hwnd

                    # 检查窗口是否最小化
                    if win32gui.IsIconic(hwnd):
                        self.logger.add_log("检测到目标窗口已最小化，正在恢复...")
                        if not self._restore_window(hwnd):
                            # 恢复失败，重新查找窗口
                            self._target_hwnd = None

            except Exception as e:
                self.logger.add_log(f"监控循环异常: {str(e)}")

            # 等待下一次检查
            time.sleep(self.check_interval)

        self.logger.add_log("窗口监控线程已退出")

    def get_status(self) -> dict:
        """
        获取监控状态
        :return: 状态信息字典
        """
        return {
            "running": self._running,
            "target_app": self._target_app_path,
            "target_hwnd": self._target_hwnd,
            "check_interval": self.check_interval
        }
