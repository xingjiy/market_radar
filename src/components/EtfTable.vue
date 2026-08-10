<script setup lang="ts">
import { Expand } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import SectionHeader from './SectionHeader.vue'
import { useMarketStore } from '../stores/market'

const market = useMarketStore()

function flowTone(row: { flow: string | null }): string {
  if (!row.flow || row.flow === '--') return ''
  return row.flow.startsWith('+') ? 'up-text' : 'down-text'
}
</script>

<template>
  <section id="etf" class="panel-card top-gap">
    <SectionHeader eyebrow="ETF FLOW RADAR · 06" title="ETF 资金雷达" caption="价格动能、资金流向、成交活跃度交叉验证">
      <el-button text type="primary" :icon="Expand" @click="ElMessage.info('ETF 资金明细将在 V2 开放')">查看全部</el-button>
    </SectionHeader>
    <div class="table-wrap">
      <el-table :data="market.displayEtfs" class="radar-table" stripe>
        <el-table-column label="ETF 名称" min-width="190">
          <template #default="{ row }">
            <div class="name-cell"><span class="etf-icon">ETF</span><div><b>{{ row.name }}</b><small>{{ row.code }}</small></div></div>
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
