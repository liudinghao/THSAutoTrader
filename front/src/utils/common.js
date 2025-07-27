/**
 * 计算涨跌停价
 * @param {string} code 股票代码
 * @param {number} preClose 昨收价
 * @returns {{limitUpPrice: number, limitDownPrice: number}}
 */
export function getLimitPrices(code, preClose) {
  if (!code || !preClose)
    return { limitUpPrice: undefined, limitDownPrice: undefined };
  const firstChar = String(code)[0];
  const limitPercent = firstChar === '3' ? 0.2 : 0.1;
  const limitUpPrice = +(preClose * (1 + limitPercent)).toFixed(2);
  const limitDownPrice = +(preClose * (1 - limitPercent)).toFixed(2);
  return { limitUpPrice, limitDownPrice };
}
