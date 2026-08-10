<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Delete, Search, Setting, Star } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import SectionHeader from './SectionHeader.vue'
import { useWatchlistStore } from '../stores/watchlist'

const router = useRouter()
const watchlistStore = useWatchlistStore()
const keyword = ref('')
const drawerOpen = ref(false)

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return watchlistStore.items
  return watchlistStore.items.filter((item) => item.name.toLowerCase().includes(kw) || item.code.includes(kw))
})

function openItem(item: { code: string }): void {
  void router.push({ path: `/stock/${item.code}` })
}

function removeItem(code: string): void {
  watchlistStore.remove(code)
  ElMessage.success('已从观察池移除')
}
</script>

<template>
  <article id="watch" class="panel-card">
    <SectionHeader eyebrow="CORE WATCH · 07" title="核心观察列表" caption="我的关注池">
      <el-button text type="primary" :icon="Setting" @click="drawerOpen = true">管理</el-button>
    </SectionHeader>
    <el-input v-model="keyword" class="watch-filter" placeholder="过滤观察池（代码 / 名称）" :prefix-icon="Search" clearable size="small" />
    <div v-if="filtered.length" class="watch-list">
      <div v-for="item in filtered" :key="item.code" class="watch-row" @click="openItem(item)">
        <button class="star-button" :aria-label="item.starred ? '取消关注' : '关注'" @click.stop="watchlistStore.toggleStar(item.code)">
          <Star :fill="item.starred ? '#f4b740' : 'none'" :color="item.starred ? '#f4b740' : '#9aa8bc'" />
        </button>
        <div class="watch-name"><b>{{ item.name }}</b><small>{{ item.code }} · {{ item.type }}</small></div>
        <b class="watch-price">{{ item.price }}</b>
        <span :class="item.change >= 0 ? 'up-text' : 'down-text'">{{ item.change > 0 ? '+' : '' }}{{ item.change }}%</span>
        <span class="watch-flow">{{ item.flow }}</span>
        <span class="status-tag">{{ item.status }}</span>
      </div>
    </div>
    <el-empty v-else description="未找到匹配标的" :image-size="60" />

    <el-drawer v-model="drawerOpen" title="管理观察池" size="380px">
      <div class="watch-manage">
        <div v-for="item in watchlistStore.items" :key="item.code" class="manage-row">
          <span class="manage-name">{{ item.name }}</span>
          <span class="manage-code">{{ item.code }} · {{ item.type }}</span>
          <el-button text type="danger" :icon="Delete" @click="removeItem(item.code)">移除</el-button>
        </div>
        <el-empty v-if="!watchlistStore.items.length" description="观察池为空" :image-size="50" />
        <el-button class="reset-btn" text type="primary" @click="watchlistStore.reset()">恢复默认观察池</el-button>
      </div>
    </el-drawer>
  </article>
</template>
