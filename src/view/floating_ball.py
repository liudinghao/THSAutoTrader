import tkinter as tk
from src.util.logger import Logger


class FloatingBall:
    def __init__(self, parent_app):
        self.parent_app = parent_app
        self.ball_window = None
        self.dragging = False
        self.drag_threshold = 5  # 拖拽识别阈值
        
        # 拖拽相关的坐标变量
        self.drag_start_x = 0  # 拖拽开始时的鼠标x坐标（屏幕坐标）
        self.drag_start_y = 0  # 拖拽开始时的鼠标y坐标（屏幕坐标）
        self.window_start_x = 0  # 拖拽开始时的窗口x位置
        self.window_start_y = 0  # 拖拽开始时的窗口y位置
        self.mouse_in_ball_x = 0  # 鼠标在小球内的相对位置x
        self.mouse_in_ball_y = 0  # 鼠标在小球内的相对位置y
        
    def create_ball(self):
        """创建悬浮小球窗口"""
        self.ball_window = tk.Toplevel()
        self.ball_window.title("")
        
        # 计算右上角位置
        screen_width = self.ball_window.winfo_screenwidth()
        # 右上角：屏幕宽度 - 小球宽度 - 边距
        x_position = screen_width - 100 - 20  # 距离右边缘20像素
        y_position = 188  # 距离顶部188像素
        
        self.ball_window.geometry(f"100x100+{x_position}+{y_position}")
        self.ball_window.overrideredirect(True)  # 去掉标题栏
        self.ball_window.attributes('-topmost', True)  # 始终置顶
        self.ball_window.attributes('-alpha', 0.7)  # 透明度调整为0.7
        
        # 设置窗口背景为透明色，避免正方形阴影
        self.ball_window.configure(bg='#000001')  # 使用接近黑色但不是纯黑的颜色
        self.ball_window.attributes('-transparentcolor', '#000001')  # 设置透明色
        
        # 创建圆形小球
        canvas = tk.Canvas(
            self.ball_window, 
            width=100, 
            height=100, 
            highlightthickness=0,
            bg='#000001',  # 使用透明色作为背景
            bd=0  # 去掉边框
        )
        canvas.pack()
        
        # 绘制科技感渐变小球
        self._draw_gradient_ball(canvas)
        canvas.create_text(50, 50, text="交易", fill="white", font=("Arial", 14, "bold"))
        
        # 设置鼠标样式和绑定事件
        canvas.configure(cursor="hand2")  # 设置手指样式
        canvas.bind("<Button-1>", self.on_ball_click)
        canvas.bind("<B1-Motion>", self.on_ball_drag)
        canvas.bind("<ButtonRelease-1>", self.on_ball_release)
        canvas.bind("<Enter>", self.on_mouse_enter)  # 鼠标进入
        canvas.bind("<Leave>", self.on_mouse_leave)  # 鼠标离开
        
        # 保存canvas引用
        self.canvas = canvas
        
    def _draw_gradient_ball(self, canvas):
        """绘制科技感渐变小球"""
        import math
        
        # 渐变色配置 - 从亮蓝到深红的科技感配色
        gradient_colors = [
            '#00D4FF',  # 亮青色（外层）
            '#0099CC',  # 蓝色
            '#0066AA',  # 深蓝
            '#1E3A8A',  # 靛蓝
            '#7C3AED',  # 紫色
            '#C026D3',  # 品红
            '#E11D48',  # 深红
            '#DC2626',  # 红色（核心）
        ]
        
        # 计算每一层的半径和位置
        center_x, center_y = 50, 50
        max_radius = 40
        layers = len(gradient_colors)
        
        # 从外到内绘制渐变层
        for i, color in enumerate(gradient_colors):
            # 计算当前层的半径（从大到小）
            radius_ratio = (layers - i) / layers
            current_radius = max_radius * radius_ratio
            
            # 计算圆形坐标
            x1 = center_x - current_radius
            y1 = center_y - current_radius
            x2 = center_x + current_radius
            y2 = center_y + current_radius
            
            # 绘制当前层
            canvas.create_oval(x1, y1, x2, y2, fill=color, outline='', width=0)
        
        # 添加高光效果（左上角）
        highlight_radius = 15
        highlight_x = center_x - 12
        highlight_y = center_y - 12
        canvas.create_oval(
            highlight_x - highlight_radius, 
            highlight_y - highlight_radius,
            highlight_x + highlight_radius, 
            highlight_y + highlight_radius,
            fill='#FFFFFF', outline='', width=0, stipple='gray25'
        )
        
        # 添加外层发光边框
        glow_colors = ['#00D4FF', '#0099CC', '#0066AA']
        for i, glow_color in enumerate(glow_colors):
            glow_radius = max_radius + 2 + i * 2
            canvas.create_oval(
                center_x - glow_radius, center_y - glow_radius,
                center_x + glow_radius, center_y + glow_radius,
                fill='', outline=glow_color, width=1
            )
        
    def on_ball_click(self, event):
        """处理小球点击事件 - 记录初始状态"""
        # 获取鼠标的屏幕绝对坐标
        self.drag_start_x = event.x_root
        self.drag_start_y = event.y_root
        
        # 获取窗口当前位置
        self.window_start_x = self.ball_window.winfo_x()
        self.window_start_y = self.ball_window.winfo_y()
        
        # 记录鼠标在小球内的相对位置
        self.mouse_in_ball_x = event.x
        self.mouse_in_ball_y = event.y
        
        # 重置拖拽状态
        self.dragging = False
        
    def on_ball_drag(self, event):
        """处理小球拖拽事件 - 完全重写拖拽逻辑"""
        # 计算鼠标移动的距离（基于屏幕坐标）
        mouse_x = event.x_root
        mouse_y = event.y_root
        
        dx = mouse_x - self.drag_start_x
        dy = mouse_y - self.drag_start_y
        
        # 检查是否超过拖拽阈值
        if not self.dragging and (abs(dx) > self.drag_threshold or abs(dy) > self.drag_threshold):
            self.dragging = True
            
        if self.dragging:
            # 计算新的窗口位置
            # 窗口位置 = 鼠标当前位置 - 鼠标在小球内的偏移
            new_window_x = mouse_x - self.mouse_in_ball_x
            new_window_y = mouse_y - self.mouse_in_ball_y
            
            # 获取屏幕尺寸
            screen_width = self.ball_window.winfo_screenwidth()
            screen_height = self.ball_window.winfo_screenheight()
            
            # 限制在屏幕范围内
            new_window_x = max(0, min(new_window_x, screen_width - 100))
            new_window_y = max(0, min(new_window_y, screen_height - 100))
            
            # 移动窗口到新位置
            try:
                self.ball_window.wm_geometry(f"+{new_window_x}+{new_window_y}")
            except:
                self.ball_window.geometry(f"100x100+{new_window_x}+{new_window_y}")
            
    def on_ball_release(self, event):
        """处理鼠标释放事件"""        
        # 如果没有拖拽过，认为是点击操作
        if not self.dragging:
            self.restore_main_window()
        
        # 重置拖拽状态
        self.dragging = False
        
    def on_mouse_enter(self, event):
        """鼠标进入小球区域"""
        # 改变鼠标样式为移动手势
        self.canvas.configure(cursor="fleur")
        
    def on_mouse_leave(self, event):
        """鼠标离开小球区域"""
        # 恢复默认手指样式
        self.canvas.configure(cursor="hand2")
    
    def restore_main_window(self):
        """恢复主窗口"""
        try:
            if self.parent_app:
                self.parent_app.deiconify()  # 显示主窗口
                self.parent_app.lift()  # 提升到最前面
                self.parent_app.focus_force()  # 强制获取焦点
            
            # 销毁小球窗口
            if self.ball_window:
                self.ball_window.destroy()
                self.ball_window = None
                
            Logger().add_log("已从悬浮小球恢复主窗口")
        except Exception as e:
            Logger().add_log(f"恢复主窗口失败: {str(e)}")
    
    def show(self):
        """显示悬浮小球"""
        if not self.ball_window:
            try:
                self.create_ball()
                Logger().add_log("悬浮小球已显示")
            except Exception as e:
                Logger().add_log(f"显示悬浮小球失败: {str(e)}")
    
    def hide(self):
        """隐藏悬浮小球"""
        if self.ball_window:
            try:
                self.ball_window.destroy()
                self.ball_window = None
                Logger().add_log("悬浮小球已隐藏")
            except Exception as e:
                Logger().add_log(f"隐藏悬浮小球失败: {str(e)}")