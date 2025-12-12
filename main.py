from src.app.automation import AutomationApp
import tkinter as tk
import sys
import win32event
import win32api
import win32gui
import win32con
import winerror
from tkinter import messagebox

# 全局互斥锁名称（唯一标识）
MUTEX_NAME = "Global\\THSAutoTrader_Single_Instance_Mutex"

def activate_existing_window(window_title):
    """激活已存在的窗口（包括托盘中的隐藏窗口）"""
    def enum_windows_callback(hwnd, result_list):
        """枚举窗口回调函数"""
        # 不检查IsWindowVisible，因为托盘程序窗口可能是隐藏的
        title = win32gui.GetWindowText(hwnd)
        if window_title in title and title:  # 确保标题不为空
            result_list.append(hwnd)
        return True  # 继续枚举

    # 查找所有匹配的窗口
    windows = []
    win32gui.EnumWindows(lambda hwnd, param: enum_windows_callback(hwnd, param), windows)

    if windows:
        hwnd = windows[0]  # 取第一个匹配的窗口
        try:
            # 先显示窗口（从托盘恢复）
            win32gui.ShowWindow(hwnd, win32con.SW_SHOW)

            # 如果窗口最小化，恢复正常大小
            if win32gui.IsIconic(hwnd):
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)

            # 使用更强力的激活方法
            # 方法1: 先将窗口设为TOPMOST
            win32gui.SetWindowPos(hwnd, win32con.HWND_TOPMOST, 0, 0, 0, 0,
                                win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_SHOWWINDOW)

            # 方法2: 尝试SetForegroundWindow
            win32gui.SetForegroundWindow(hwnd)

            # 方法3: 再取消TOPMOST（因为程序本身会管理置顶属性）
            win32gui.SetWindowPos(hwnd, win32con.HWND_NOTOPMOST, 0, 0, 0, 0,
                                win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_SHOWWINDOW)

            return True
        except Exception as e:
            print(f"激活窗口失败: {str(e)}")
            return False
    return False

def check_single_instance():
    """检查是否已有实例在运行，如果有则激活已有窗口"""
    # 尝试创建互斥锁
    mutex = win32event.CreateMutex(None, False, MUTEX_NAME)
    last_error = win32api.GetLastError()

    # 如果互斥锁已存在，说明程序已在运行
    if last_error == winerror.ERROR_ALREADY_EXISTS:
        # 尝试查找并激活已有窗口
        activate_existing_window("下单接口")
        # 无论是否成功激活，都退出当前实例
        return False

    # 程序是第一个实例，返回互斥锁句柄
    return mutex

def main():
    # 检查单实例
    mutex = check_single_instance()
    if not mutex:
        # 已有实例在运行，退出
        sys.exit(0)

    try:
        root = tk.Tk()
        root.title("下单接口 v1.0")
        root.resizable(False, False)
        root.attributes('-topmost', True)
        root.attributes('-alpha', 0.8)
        app = AutomationApp(root)
        root.mainloop()
    finally:
        # 程序退出时释放互斥锁
        if mutex:
            win32api.CloseHandle(mutex)

def dev():
    import hupper
    print('热加载')
    reloader = hupper.start_reloader('main.main')
    reloader.watch_files('**/*.py')

if __name__ == "__main__":
    main()