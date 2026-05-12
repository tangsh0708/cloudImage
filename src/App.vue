<script setup>
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'

onLaunch(() => {
  console.log('启动')
})

onShow(() => {
  console.log('显示')
})

onHide(() => {
  console.log('隐藏')
})
</script>

<style>
/* 每个页面公共 css */
</style>
