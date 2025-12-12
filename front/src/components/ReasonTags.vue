<template>
  <div v-if="reasons && reasons.length" class="reason-tags">
    <el-tag
      v-for="(reason, index) in reasons"
      :key="index"
      :type="getReasonTagType(reason)"
      size="small"
      class="reason-tag"
    >
      {{ reason }}
    </el-tag>
  </div>
  <span v-else>--</span>
</template>

<script>
import { tagColorManager } from '../config/tagColors'

export default {
  name: 'ReasonTags',
  props: {
    reasonType: {
      type: String,
      default: ''
    }
  },
  computed: {
    reasons() {
      if (!this.reasonType) return []
      return this.reasonType.split('+').map(r => r.trim()).filter(r => r)
    }
  },
  methods: {
    getReasonTagType(reason) {
      return tagColorManager.getTagColorClass(reason)
    }
  }
}
</script>

<style scoped>
.reason-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-mini);
  justify-content: center;
}

.reason-tag {
  margin: 0;
}

/* 确保标签颜色正确应用 */
:deep(.el-tag--success) {
  background-color: var(--tag-success-bg) !important;
  border-color: var(--tag-success-border) !important;
  color: var(--tag-success-color) !important;
}

:deep(.el-tag--warning) {
  background-color: var(--tag-warning-bg) !important;
  border-color: var(--tag-warning-border) !important;
  color: var(--tag-warning-color) !important;
}

:deep(.el-tag--danger) {
  background-color: var(--tag-danger-bg) !important;
  border-color: var(--tag-danger-border) !important;
  color: var(--tag-danger-color) !important;
}

:deep(.el-tag--info) {
  background-color: var(--tag-info-bg) !important;
  border-color: var(--tag-info-border) !important;
  color: var(--tag-info-color) !important;
}

:deep(.el-tag--primary) {
  background-color: var(--tag-primary-bg) !important;
  border-color: var(--tag-primary-border) !important;
  color: var(--tag-primary-color) !important;
}
</style> 