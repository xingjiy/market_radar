<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import GlobalSearch from '../components/GlobalSearch.vue'
import PulseGauge from '../components/PulseGauge.vue'
import MetricGrid from '../components/MetricGrid.vue'
import PulseTrend from '../components/PulseTrend.vue'
import EmotionRadar from '../components/EmotionRadar.vue'
import SectorBar from '../components/SectorBar.vue'
import RotationMap from '../components/RotationMap.vue'
import EtfTable from '../components/EtfTable.vue'
import WatchList from '../components/WatchList.vue'
import AiBriefCard from '../components/AiBriefCard.vue'
import { useMarketStore } from '../stores/market'

const market = useMarketStore()

onMounted(() => {
  void market.refresh(false)
  market.startAutoRefresh()
})

onBeforeUnmount(() => {
  market.stopAutoRefresh()
})
</script>

<template>
  <main>
    <section class="search-row">
      <GlobalSearch />
      <el-button type="primary" size="large" class="search-button" :loading="market.loading" :icon="Refresh" @click="market.refresh()">刷新</el-button>
    </section>

    <PulseGauge />
    <MetricGrid />

    <section class="two-col top-gap">
      <PulseTrend />
      <EmotionRadar />
    </section>

    <section class="two-col top-gap">
      <SectorBar />
      <RotationMap />
    </section>

    <EtfTable />

    <section class="two-col top-gap bottom-gap">
      <WatchList />
      <AiBriefCard />
    </section>
  </main>
</template>
