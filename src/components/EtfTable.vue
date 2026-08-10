<script setup lang="ts">
import { computed, ref } from 'vue'
import { Expand } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import SectionHeader from './SectionHeader.vue'
import { useMarketStore } from '../stores/market'

const market = useMarketStore()

type EtfTab = 'radar' | 'amount' | 'gain' | 'loss'
const tab = ref<EtfTab>('radar')

const tabs: Array<{ value: EtfTab; label: string }> = [
  { value: 'radar', label: '综合雷达' },
  { value: 'amount', label: '成交额 TOP5' },
  { value: 'gain', label: '涨幅 TOP5' },
  { value: 'loss', label: '跌幅 TOP5' }
]

/** 按标签排序取 TOP：综合雷达取评分前 8，其余取对应指标前 5，并附加 rank 用于徽标展示 */
const etfRows = computed(() => {
  const list = [...market.displayEtfs]
  let sorted: typeof list
  if (tab.value === 'amount') sorted = list.sort((a, b) => (b.amountYi ?? 0) - (a.amountYi ?? 0))
  else if (tab.value === 'gain') sorted = list.sort((a, b) => b.change - a.change)
  else if (tab.value === 'loss') sorted = list.sort((a, b) => a.change - b.change)
  else sorted = list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const take = tab.value === 'radar' ? 8 : 5
  return sorted.slice(0, take).map((item, index) => ({ ...item, rank: index + 1 }))
})

const isTop = computed(() => tab.value !== 'radar')

function flowTone(row: { flow: string | null }): string {
  if (!row.flow || row.flow === '--') return ''
  return row.flow.startsWith('+') ? 'up-text' : 'down-text'
}
</script>

<template>
  <section id="etf" class="panel-card top-gap">
    <SectionHeader eyebrow="ETF FLOW RADAR · 07" title="ETF 资金雷达" caption="价格动能、资金流向、成交活跃度交叉验证">
      <el-button text type="primary" :icon="Expand" @click="ElMessage.info('ETF 资金明细将在 V2 开放')">查看全部</el-button>
    </SectionHeader>
    <div class="segmented etf-tabs">
      <button
        v-for="item in tabs"
        :key="item.value"
        :class="{ active: tab === item.value }"
        type="button"
        @click="tab = item.value"
      >{{ item.label }}</button>
    </div>
    <div class="table-wrap">
      <el-table :data="etfRows" class="radar-table" stripe>
        <el-table-column label="ETF 名称" min-width="190">
          <template #default="{ row }">
            <div class="name-cell"><span v-if="isTop" class="rank-badge" :class="'rank-' + row.rank">{{ 'TOP' + row.rank }}</span><span v-else class="etf-icon">ETF</span><div><b>{{ row.name }}</b><small>{{ row.code }}</small></div></div>
          </template>
        </el-table-column>
        <el-table-column prop="price" label="最新价" width="110" />
        <el-table-column label="涨跌幅" width="120">
          <template #default="{ row }"><span :class="row.change >= 0 ? 'up-text' : 'down-text'">{{ row.change > 0 ? '+' : '' }}{{ row.change }}%</span></template>
        </el-table-column>
        <el-table-column prop="amount" label="成交额" width="130" />
        <el-table-column label="资金净流入" width="150">
          <template #default="{ row }"><span :class="flowTone(row)">{{ row.flow }}</span></template>
        </el-table-column>
        <el-table-column label="雷达信号" min-width="130">
          <template #default="{ row }"><span class="signal-tag">{{ row.signal }}</span></template>
        </el-table-column>
        <el-table-column label="综合评分" width="100" sortable prop="score">
          <template #default="{ row }"><span class="score-tag">{{ row.score ?? '--' }}</span></template>
        </el-table-column>
      </el-table>
    </div>
  </section>
</template>

<style scoped>
.etf-tabs { margin-top: 14px; }
.rank-badge { display: inline-grid; width: 34px; height: 22px; place-items: center; margin-right: 8px; border-radius: 6px; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .5px; }
.rank-1 { background: linear-gradient(135deg, #ffb03a, #ff7a45); }
.rank-2 { background: linear-gradient(135deg, #9db4cc, #7d93ad); }
.rank-3 { background: linear-gradient(135deg, #d89b6c, #c07b4a); }
.rank-4, .rank-5 { background: #aab7c8; }
</style>
