import os
from src.util.logger import Logger
from src.service.window_service import WindowService
from src.models.app_model import AppModel
import time

class TradingService:
    def __init__(self):
        self.window_service = WindowService()
        self.model = AppModel()
        self.logger = Logger()

    def cancel_all_orders(self):
        """撤销所有可撤委托"""
        try:
            trading_path = self.model.get_trading_app()
            self.window_service.activate_window(trading_path)

            # 获取目标窗口
            window = self.window_service.get_target_window({'title': '网上股票交易系统5.0'})

            # 点击窗口达到聚焦效果，否则快捷键会失效
            window.click_input()
            time.sleep(0.3)

            # 先刷新数据，确保获取最新委托信息
            self.window_service.send_key('F5')
            time.sleep(0.3)

            # 使用F3快捷键打开委托撤单界面
            self.window_service.send_key('F3')
            self.logger.add_log("已打开委托撤单界面")
            time.sleep(0.1)

            # 点击批量撤单按钮
            self.window_service.click_element(window, 30001)
            
            self.logger.add_log("批量撤单操作完成")
            return True
            
        except Exception as e:
            error_msg = f"批量撤单操作失败: {str(e)}"
            self.logger.add_log(error_msg)
            raise Exception(error_msg)
