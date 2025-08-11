<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="800px"
    custom-class="analysis-result-dialog"
    :before-close="handleClose"
  >
    <div class="analysis-result-container" v-if="analysisData">
      <div class="analysis-header">
        <h2>📊 {{ analysisData.stockName }} 智能分析报告</h2>
        <div class="analysis-meta">
          <span>📅 生成时间: {{ formatDate(analysisData.timestamp) }}</span>
        </div>
      </div>
      
      <div class="analysis-content markdown-body" v-html="formattedContent"></div>
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '分析报告'
  },
  analysisData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue', 'close'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 创建markdown-it实例
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (__) {}
    }
    return hljs.highlightAuto(str).value
  }
})

const formattedContent = computed(() => {
  if (!props.analysisData?.analysis) return ''
  return md.render(props.analysisData.analysis)
})

const formatDate = (dateString) => {
  if (!dateString) return new Date().toLocaleString()
  return new Date(dateString).toLocaleString()
}

const handleClose = () => {
  visible.value = false
  emit('close')
}
</script>

<style scoped>
.analysis-result-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  line-height: 1.6;
  color: #333;
}

.analysis-header {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f0f0f0;
}

.analysis-header h2 {
  margin: 0 0 8px 0;
  color: #1890ff;
  font-size: 24px;
}

.analysis-meta {
  color: #666;
  font-size: 14px;
}

.analysis-content {
  max-height: 600px;
  overflow-y: auto;
  padding: 0 8px;
}

/* github markdown样式 */
:deep(.markdown-body) {
  box-sizing: border-box;
  min-width: 200px;
  max-width: 980px;
  margin: 0 auto;
  padding: 16px;
  color: #24292e;
  line-height: 1.5;
  word-wrap: break-word;
}

:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3),
:deep(.markdown-body h4),
:deep(.markdown-body h5),
:deep(.markdown-body h6) {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

:deep(.markdown-body h1) {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

:deep(.markdown-body h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

:deep(.markdown-body h3) {
  font-size: 1.25em;
}

:deep(.markdown-body h4) {
  font-size: 1em;
}

:deep(.markdown-body h5) {
  font-size: 0.875em;
}

:deep(.markdown-body h6) {
  font-size: 0.85em;
  color: #6a737d;
}

:deep(.markdown-body p) {
  margin-bottom: 16px;
}

:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  margin-bottom: 16px;
  padding-left: 2em;
}

:deep(.markdown-body li) {
  margin-bottom: 0.25em;
}

:deep(.markdown-body pre) {
  background-color: #f6f8fa;
  border-radius: 6px;
  font-size: 85%;
  line-height: 1.45;
  overflow: auto;
  padding: 16px;
}

:deep(.markdown-body code) {
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  font-size: 85%;
  margin: 0;
  padding: 0.2em 0.4em;
}

:deep(.markdown-body pre code) {
  background-color: transparent;
  border: 0;
  font-size: 100%;
  word-break: normal;
  white-space: pre;
  word-wrap: normal;
}

:deep(.markdown-body blockquote) {
  border-left: 0.25em solid #dfe2e5;
  color: #6a737d;
  margin: 0;
  padding: 0 1em;
}

:deep(.markdown-body table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 16px;
}

:deep(.markdown-body table th),
:deep(.markdown-body table td) {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}

:deep(.markdown-body table th) {
  font-weight: 600;
  background-color: #f6f8fa;
}

:deep(.markdown-body a) {
  color: #0366d6;
  text-decoration: none;
}

:deep(.markdown-body a:hover) {
  text-decoration: underline;
}

:deep(.markdown-body img) {
  max-width: 100%;
  height: auto;
}
</style>