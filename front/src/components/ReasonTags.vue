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
</style> 