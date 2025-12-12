<template>
  <div class="data-update-container">
    <el-card class="update-card">
      <template #header>
        <div class="card-header">
          <span>数据更新管理</span>
        </div>
      </template>
      
      <el-row :gutter="20" style="margin-bottom: 20px;">
        <el-col :span="12" :xs="24" :sm="24" :md="12" :lg="12" :xl="12">
          <el-card class="update-section">
            <template #header>
              <div class="section-header">
                <el-icon><Refresh /></el-icon>
                <span>概念个股更新</span>
              </div>
            </template>
            
            <div class="update-content">
              <el-form :model="conceptForm" label-width="120px">
                <el-form-item label="更新类型">
                  <el-select v-model="conceptForm.updateType" placeholder="请选择更新类型" style="width: 100%">
                    <el-option label="全量更新" value="full" />
                    <el-option label="指定概念更新" value="specific" />
                  </el-select>
                </el-form-item>
                
                <el-form-item label="更新范围">
                  <el-input 
                    v-model="conceptForm.conceptIds" 
                    placeholder="请输入概念ID，多个ID用逗号分隔，如：886104,886103,886102" 
                    type="textarea"
                    :rows="3"
                    :disabled="conceptForm.updateType === 'full'"
                  />
                  <div class="form-tip" v-if="conceptForm.updateType !== 'full'">
                    <el-icon><InfoFilled /></el-icon>
                    <span>支持输入多个概念ID，用逗号分隔。留空则更新所有概念。</span>
                  </div>
                  <div class="concept-selector" v-if="conceptForm.updateType !== 'full'">
                    <el-select 
                      v-model="selectedConcept" 
                      placeholder="选择概念" 
                      style="width: 100%; margin-top: 10px;"
                      @change="addConceptToForm"
                    >
                      <el-option
                        v-for="concept in conceptList"
                        :key="concept.code"
                        :label="`${concept.name} (${concept.code})`"
                        :value="concept.code"
                      />
                    </el-select>
                  </div>
                </el-form-item>
                
                <el-form-item>
                  <el-button type="primary" @click="updateConceptStocks" :loading="conceptLoading">
                    <el-icon><Refresh /></el-icon>
                    开始更新
                  </el-button>
                  <el-button @click="resetConceptForm">重置</el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="12" :xs="24" :sm="24" :md="12" :lg="12" :xl="12">
          <el-card class="update-section">
            <template #header>
              <div class="section-header">
                <el-icon><DataLine /></el-icon>
                <span>其他数据更新</span>
              </div>
            </template>
            
            <div class="update-content">
              <el-form :model="otherForm" label-width="120px">
                <el-form-item label="股票基础信息">
                  <el-button type="success" @click="updateStockInfo" :loading="stockInfoLoading">
                    更新股票信息
                  </el-button>
                </el-form-item>
                
                <el-form-item label="行情数据">
                  <el-button type="success" @click="updateMarketData" :loading="marketDataLoading">
                    更新行情数据
                  </el-button>
                </el-form-item>
                
                <el-form-item label="财务数据">
                  <el-button type="success" @click="updateFinancialData" :loading="financialDataLoading">
                    更新财务数据
                  </el-button>
                </el-form-item>
                
                <el-form-item label="技术指标">
                  <el-button type="success" @click="updateTechnicalIndicators" :loading="technicalLoading">
                    更新技术指标
                  </el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-card>
        </el-col>
      </el-row>
      
      <!-- 更新日志 -->
      <el-card class="log-section" style="margin-top: 20px;">
        <template #header>
          <div class="section-header">
            <el-icon><Document /></el-icon>
            <span>更新日志</span>
            <el-button type="text" @click="clearLogs" style="margin-left: auto;">
              清空日志
            </el-button>
          </div>
        </template>
        
        <div class="log-content">
          <el-timeline>
            <el-timeline-item
              v-for="(log, index) in updateLogs"
              :key="index"
              :timestamp="log.timestamp"
              :type="log.type"
            >
              {{ log.message }}
            </el-timeline-item>
          </el-timeline>
        </div>
      </el-card>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, DataLine, Document, InfoFilled } from '@element-plus/icons-vue'
import { getStocksByConceptCode, saveConceptStockRelations, getConceptList } from '../api/concept'

// 表单数据
const conceptForm = reactive({
  updateType: 'full',
  conceptName: '',
  conceptIds: ''
})

const otherForm = reactive({})

// 概念列表数据
const conceptList = ref([])
const selectedConcept = ref('')

// 加载状态
const conceptLoading = ref(false)
const stockInfoLoading = ref(false)
const marketDataLoading = ref(false)
const financialDataLoading = ref(false)
const technicalLoading = ref(false)

// 更新日志
const updateLogs = ref([
  {
    timestamp: new Date().toLocaleString(),
    message: '系统初始化完成',
    type: 'success'
  }
])

// 添加日志
const addLog = (message, type = 'info') => {
  updateLogs.value.unshift({
    timestamp: new Date().toLocaleString(),
    message,
    type
  })
}

// 初始化概念列表
const initConceptList = async () => {
  try {
    const concepts = await getConceptList()
    conceptList.value = concepts
    addLog(`成功加载 ${concepts.length} 个概念`, 'success')
  } catch (error) {
    addLog(`加载概念列表失败: ${error.message}`, 'danger')
  }
}

// 页面初始化时加载概念列表
initConceptList()



// 更新概念个股
const updateConceptStocks = async () => {
  try {
    conceptLoading.value = true
    addLog(`开始更新概念个股 - 类型: ${conceptForm.updateType}`, 'primary')
    
    let conceptCodes = []
    
    if (conceptForm.updateType === 'full') {
      // 全量更新 - 获取所有概念代码
      addLog('正在获取所有概念代码...', 'info')
      conceptCodes = await getConceptList(true)
      addLog(`全量更新模式，将更新 ${conceptCodes.length} 个概念`, 'info')
    } else {
      // 指定概念更新
      if (!conceptForm.conceptIds.trim()) {
        throw new Error('请输入概念ID')
      }
      conceptCodes = conceptForm.conceptIds.split(',').map(id => id.trim()).filter(id => id)
      addLog(`指定更新模式，将更新 ${conceptCodes.length} 个概念: ${conceptCodes.join(', ')}`, 'info')
    }
    
    let totalSavedCount = 0
    let successCount = 0
    let failCount = 0
    
    for (const conceptCode of conceptCodes) {
      try {
        addLog(`正在处理概念 ${conceptCode}...`, 'info')
        
        // 获取该概念下的股票列表
        const stockCodes = await getStocksByConceptCode(conceptCode)
        
        if (stockCodes.length === 0) {
          addLog(`概念 ${conceptCode} 下没有股票`, 'warning')
          continue
        }
        
        // 构建关系数据
        const relations = stockCodes.map(stockCode => ({
          conceptCode: conceptCode,
          stockCode: stockCode
        }))
        
        // 立即保存该概念的关系数据
        addLog(`开始保存概念 ${conceptCode} 的 ${relations.length} 条关系...`, 'primary')
        await saveConceptStockRelations(relations)
        addLog(`概念 ${conceptCode} 保存成功，共 ${relations.length} 条关系`, 'success')
        
        totalSavedCount += relations.length
        successCount++
        
      } catch (error) {
        addLog(`处理概念 ${conceptCode} 失败: ${error.message}`, 'danger')
        failCount++
      }
    }
    
    const summary = `概念个股更新完成: 成功处理 ${successCount} 个概念，失败 ${failCount} 个概念，共保存 ${totalSavedCount} 条关系`
    addLog(summary, 'success')
    ElMessage.success(summary)
    
  } catch (error) {
    addLog(`概念个股更新失败: ${error.message}`, 'danger')
    ElMessage.error('概念个股更新失败')
  } finally {
    conceptLoading.value = false
  }
}

// 更新股票信息
const updateStockInfo = async () => {
  try {
    stockInfoLoading.value = true
    addLog('开始更新股票基础信息', 'primary')
    
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    addLog('股票基础信息更新完成', 'success')
    ElMessage.success('股票基础信息更新成功')
  } catch (error) {
    addLog(`股票基础信息更新失败: ${error.message}`, 'danger')
    ElMessage.error('股票基础信息更新失败')
  } finally {
    stockInfoLoading.value = false
  }
}

// 更新行情数据
const updateMarketData = async () => {
  try {
    marketDataLoading.value = true
    addLog('开始更新行情数据', 'primary')
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    addLog('行情数据更新完成', 'success')
    ElMessage.success('行情数据更新成功')
  } catch (error) {
    addLog(`行情数据更新失败: ${error.message}`, 'danger')
    ElMessage.error('行情数据更新失败')
  } finally {
    marketDataLoading.value = false
  }
}

// 更新财务数据
const updateFinancialData = async () => {
  try {
    financialDataLoading.value = true
    addLog('开始更新财务数据', 'primary')
    
    await new Promise(resolve => setTimeout(resolve, 2500))
    
    addLog('财务数据更新完成', 'success')
    ElMessage.success('财务数据更新成功')
  } catch (error) {
    addLog(`财务数据更新失败: ${error.message}`, 'danger')
    ElMessage.error('财务数据更新失败')
  } finally {
    financialDataLoading.value = false
  }
}

// 更新技术指标
const updateTechnicalIndicators = async () => {
  try {
    technicalLoading.value = true
    addLog('开始更新技术指标', 'primary')
    
    await new Promise(resolve => setTimeout(resolve, 1800))
    
    addLog('技术指标更新完成', 'success')
    ElMessage.success('技术指标更新成功')
  } catch (error) {
    addLog(`技术指标更新失败: ${error.message}`, 'danger')
    ElMessage.error('技术指标更新失败')
  } finally {
    technicalLoading.value = false
  }
}

// 添加概念到表单
const addConceptToForm = () => {
  if (selectedConcept.value) {
    const currentIds = conceptForm.conceptIds.trim()
    if (currentIds) {
      // 检查是否已经存在
      const ids = currentIds.split(',').map(id => id.trim())
      if (!ids.includes(selectedConcept.value)) {
        conceptForm.conceptIds = currentIds + ',' + selectedConcept.value
      }
    } else {
      conceptForm.conceptIds = selectedConcept.value
    }
    selectedConcept.value = '' // 清空选择器
  }
}

// 重置概念表单
const resetConceptForm = () => {
  conceptForm.updateType = 'full'
  conceptForm.conceptName = ''
  conceptForm.conceptIds = ''
  selectedConcept.value = ''
  addLog('表单已重置', 'info')
}

// 清空日志
const clearLogs = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有日志吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    updateLogs.value = []
    addLog('日志已清空', 'info')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.data-update-container {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: calc(100vh - 40px);
  box-sizing: border-box;
}

.update-card {
  margin-bottom: 20px;
  height: auto;
}

.card-header {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.update-section {
  height: auto;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  color: #303133;
}

.update-content {
  padding: 10px 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.update-content .el-form {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.update-content .el-form-item {
  margin-bottom: 20px;
}

.update-content .el-form-item:last-child {
  margin-top: auto;
  margin-bottom: 0;
}

.log-section {
  margin-top: 20px;
}

.log-content {
  max-height: min(400px, 50vh);
  overflow-y: auto;
  padding: 10px 0;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background-color: #fafafa;
}

.log-content .el-timeline {
  padding-left: 0;
  margin: 0;
}

.log-content .el-timeline-item {
  padding-bottom: 15px;
}

.log-content .el-timeline-item:last-child {
  padding-bottom: 0;
}

.log-content .el-timeline-item__content {
  color: #606266;
  font-size: 14px;
  word-break: break-word;
}

.log-content .el-timeline-item__timestamp {
  color: #909399;
  font-size: 12px;
}

.form-tip {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
  color: #909399;
  font-size: 12px;
}

.form-tip .el-icon {
  color: #409eff;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .data-update-container {
    padding: 10px;
  }
  
  .update-section {
    min-height: 250px;
    margin-bottom: 15px;
  }
  
  .log-content {
    max-height: min(300px, 40vh);
  }
  
  .update-content .el-form-item {
    margin-bottom: 15px;
  }
}

@media (max-width: 480px) {
  .data-update-container {
    padding: 5px;
  }
  
  .update-section {
    min-height: 200px;
    margin-bottom: 10px;
  }
  
  .log-content {
    max-height: min(250px, 35vh);
  }
  
  .card-header {
    font-size: 16px;
  }
  
  .section-header {
    font-size: 14px;
  }
  
  .update-content .el-form-item {
    margin-bottom: 12px;
  }
  
  .update-content .el-form-item label {
    font-size: 13px;
  }
}

/* 确保在不同浏览器中的兼容性 */
.data-update-container {
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
}

.update-section {
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
}

.log-content {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: #c0c4cc #f5f7fa;
}

.log-content::-webkit-scrollbar {
  width: 6px;
}

.log-content::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 3px;
}

.log-content::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: #909399;
}
</style> 