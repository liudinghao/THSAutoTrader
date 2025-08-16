import tkinter as tk
from PIL import Image, ImageDraw
import pystray
import threading
from src.util.logger import Logger


class SystemTray:
    def __init__(self, main_window, app_instance):
        self.main_window = main_window
        self.app_instance = app_instance
        self.tray_icon = None
        self.is_tray_running = False
        
    def create_tray_icon(self):
        """创建托盘图标"""
        # 创建一个简单的红色圆形图标
        image = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        
        # 绘制红色圆形
        draw.ellipse([8, 8, 56, 56], fill='#E74C3C', outline='#C0392B', width=3)
        
        # 添加文字
        try:
            # 尝试使用默认字体
            draw.text((32, 32), "财", fill='white', anchor='mm')
        except:
            # 如果字体有问题，使用简单标记
            draw.text((28, 25), "THS", fill='white')
        
        return image
    
    def create_menu(self):
        """创建托盘右键菜单"""
        menu = pystray.Menu(
            pystray.MenuItem("显示主窗口", self.show_window, default=True),
            pystray.MenuItem("悬浮小球", self.show_floating_ball),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("退出程序", self.quit_application)
        )
        return menu
    
    def show_window(self, icon=None, item=None):
        """显示主窗口"""
        try:
            self.main_window.deiconify()
            self.main_window.lift()
            self.main_window.focus_force()
            Logger().add_log("已从托盘恢复主窗口")
        except Exception as e:
            Logger().add_log(f"恢复主窗口失败: {str(e)}")
    
    def show_floating_ball(self, icon=None, item=None):
        """显示悬浮小球"""
        try:
            # 隐藏主窗口
            self.main_window.withdraw()
            # 显示悬浮小球
            if hasattr(self.app_instance, 'view') and hasattr(self.app_instance.view, 'floating_ball'):
                self.app_instance.view.floating_ball.show()
                Logger().add_log("已从托盘切换到悬浮模式")
        except Exception as e:
            Logger().add_log(f"切换悬浮模式失败: {str(e)}")
    
    def quit_application(self, icon=None, item=None):
        """退出应用程序"""
        try:
            Logger().add_log("正在退出应用程序...")
            
            # 停止托盘图标
            if self.tray_icon:
                self.tray_icon.stop()
            
            # 销毁主窗口
            self.main_window.quit()
            self.main_window.destroy()
            
        except Exception as e:
            Logger().add_log(f"退出程序失败: {str(e)}")
    
    def hide_to_tray(self):
        """最小化到托盘"""
        if not self.is_tray_running:
            self.start_tray()
        
        # 隐藏主窗口
        self.main_window.withdraw()
        Logger().add_log("已最小化到系统托盘")
    
    def start_tray(self):
        """启动托盘图标"""
        if self.is_tray_running:
            return
            
        try:
            icon_image = self.create_tray_icon()
            menu = self.create_menu()
            
            self.tray_icon = pystray.Icon(
                "THS交易助手",
                icon_image,
                "THS自动交易助手",
                menu
            )
            
            # 在后台线程中运行托盘
            def run_tray():
                self.is_tray_running = True
                self.tray_icon.run()
                self.is_tray_running = False
            
            tray_thread = threading.Thread(target=run_tray, daemon=True)
            tray_thread.start()
            
            Logger().add_log("系统托盘已启动")
            
        except Exception as e:
            Logger().add_log(f"启动系统托盘失败: {str(e)}")
    
    def stop_tray(self):
        """停止托盘图标"""
        if self.tray_icon and self.is_tray_running:
            self.tray_icon.stop()
            self.is_tray_running = False