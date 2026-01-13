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

    def cancel_all_orders(self, cancel_type=None):
        """撤销委托
        Args:
            cancel_type (str, optional): 撤单类型
                - 'A' 或 None: 全部撤单 (control_id: 30001)
                - 'X': 撤买 (control_id: 30002)
                - 'C': 撤卖 (control_id: 30003)
        """
        try:
            trading_path = self.model.get_trading_app()
            self.window_service.activate_window(trading_path)

            # 获取目标窗口
            window = self.window_service.get_target_window({'title': '网上股票交易系统5.0'})

            # 点击窗口达到聚焦效果，否则快捷键会失效
            window.click_input()
            time.sleep(0.1)

            # 先刷新数据，确保获取最新委托信息
            self.window_service.send_key('F5')
            time.sleep(0.1)

            # 使用F3快捷键打开委托撤单界面
            self.window_service.send_key('F3')
            self.logger.add_log("已打开委托撤单界面")
            time.sleep(0.1)

            # 根据撤单类型选择对应的control_id
            control_id_map = {
                'A': 30001,  # 全部撤单
                'X': 30002,  # 撤买
                'C': 30003   # 撤卖
            }

            # 默认为全部撤单
            control_id = control_id_map.get(cancel_type, 30001)

            # 点击对应的撤单按钮
            self.window_service.click_element(window, control_id)

            operation_name = {
                30001: "全部撤单",
                30002: "撤买",
                30003: "撤卖"
            }.get(control_id, "撤单")

            self.logger.add_log(f"{operation_name}操作完成")
            return True

        except Exception as e:
            error_msg = f"撤单操作失败: {str(e)}"
            self.logger.add_log(error_msg)
            raise Exception(error_msg)
