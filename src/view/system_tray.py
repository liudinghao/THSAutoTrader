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
        """创建科技感渐变托盘图标"""
        from PIL import ImageDraw, ImageFilter
        import numpy as np
        
        # 创建高分辨率图标
        size = 64
        image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        
        # 科技感渐变色（与悬浮小球一致）
        gradient_colors = [
            (0, 212, 255),    # 亮青色
            (0, 153, 204),    # 蓝色
            (0, 102, 170),    # 深蓝
            (30, 58, 138),    # 靛蓝
            (124, 58, 237),   # 紫色
            (192, 38, 211),   # 品红
            (225, 29, 72),    # 深红
            (220, 38, 38),    # 红色（核心）
        ]
        
        # 绘制渐变圆形
        center = size // 2
        max_radius = size // 2 - 4
        layers = len(gradient_colors)
        
        for i, color in enumerate(gradient_colors):
            # 计算当前层半径
            radius_ratio = (layers - i) / layers
            current_radius = int(max_radius * radius_ratio)
            
            # 绘制圆形
            left = center - current_radius
            top = center - current_radius
            right = center + current_radius
            bottom = center + current_radius
            
            draw.ellipse([left, top, right, bottom], fill=color)
        
        # 添加高光效果
        highlight_radius = 8
        highlight_x = center - 6
        highlight_y = center - 6
        draw.ellipse([
            highlight_x - highlight_radius, 
            highlight_y - highlight_radius,
            highlight_x + highlight_radius, 
            highlight_y + highlight_radius
        ], fill=(255, 255, 255, 100))
        
        # 添加文字
        try:
            # 使用默认字体绘制文字
            text_bbox = draw.textbbox((0, 0), "交易")
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            text_x = (size - text_width) // 2
            text_y = (size - text_height) // 2
            draw.text((text_x, text_y), "交易", fill='white')
        except:
            # 备用方案
            draw.text((center - 12, center - 8), "THS", fill='white')
        
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