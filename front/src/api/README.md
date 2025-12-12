# 概念股票更新功能说明

## 功能概述

本功能用于根据概念 ID 获取股票列表并保存概念股票关系数据。

## API 接口说明

### 1. 获取概念股票列表

**协议格式：**

```javascript
API.use({
  method: 'Util.getBlockStockByCode',
  data: '885959', // 板块或者概念的代码
  success: function (d) {
    console.log(d);
  },
});
```

**返回格式：**

- 返回内容为以逗号分隔的股票代码字符串
- 例如：`000727,000823,002134,002217,002384`

### 2. 保存概念股票关系

**接口地址：** `https://www.wttiao.com/moni/concepts/relations`

**请求方式：** POST

**请求体格式：**

```json
{
  "relations": [
    {
      "conceptCode": "881100",
      "stockCode": "000001"
    },
    {
      "conceptCode": "881100",
      "stockCode": "000002"
    },
    {
      "conceptCode": "881200",
      "stockCode": "000001"
    }
  ]
}
```

## 使用说明

### 全量更新模式

1. 选择"全量更新"类型
2. 系统会自动获取所有概念代码
3. 逐个处理每个概念，获取其下的股票列表
4. 批量保存所有概念股票关系

### 指定概念更新模式

1. 选择"指定概念更新"类型
2. 在"更新范围"输入框中输入概念 ID，多个 ID 用逗号分隔
3. 例如：`881100,881200,885959`
4. 系统会处理指定的概念并保存关系

## 文件结构

- `src/api/concept.js` - 概念相关的 API 函数
- `src/utils/quoteApi.js` - 客户端协议封装（包含 `Util.getBlockStockByCode`）
- `src/views/DataUpdate.vue` - 数据更新页面组件

## API 接口列表

### 1. 获取概念列表

- **接口地址：** `https://www.wttiao.com/moni/concepts/list/`
- **请求方式：** GET
- **参数：** `onlyCodes` (可选) - 为 true 时只返回概念代码数组，为 false 时返回完整概念信息
- **返回格式：**

```json
{
  "code": 0,
  "msg": "成功",
  "data": [
    {
      "id": 637,
      "name": "2025中报预增",
      "code": "886104",
      "marketId": 48
    }
  ]
}
```

## 函数说明

### getConceptList(onlyCodes = false)

- **功能：** 获取概念列表
- **参数：**
  - `onlyCodes`: 布尔值，默认为 false
    - `true`: 只返回概念代码数组 `['886104', '886103', ...]`
    - `false`: 返回完整概念信息数组 `[{id, name, code, marketId}, ...]`
- **使用示例：**

  ```javascript
  // 获取完整概念信息（用于显示选择器）
  const concepts = await getConceptList();

  // 只获取概念代码（用于全量更新）
  const codes = await getConceptList(true);
  ```

### 2. 获取概念股票列表

- **协议格式：** `API.use({method: 'Util.getBlockStockByCode', data: '概念代码'})`
- **返回格式：** 逗号分隔的股票代码字符串
- **封装位置：** `src/utils/quoteApi.js` 中的 `getStocksByConceptCode` 函数

### 3. 保存概念股票关系

- **接口地址：** `https://www.wttiao.com/moni/concepts/relations`
- **请求方式：** POST
- **请求体格式：** 包含 relations 数组的 JSON 对象

## 注意事项

1. 概念列表接口已经集成，会自动加载所有可用概念
2. 客户端协议 `Util.getBlockStockByCode` 已封装在 `src/utils/quoteApi.js` 中
3. 全量更新模式现在使用真实的概念列表接口
4. 建议在生产环境中添加适当的错误处理和重试机制
