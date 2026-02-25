/**
 * 监控页面脚本
 * 适配新的 MongoDB 数据结构：{ title, avatar, screenshot, status, available }
 */

document.addEventListener('DOMContentLoaded', function() {
  const monitoringConfig = window.MONITORING_CONFIG || {};
  let apiUrl = monitoringConfig.apiUrl || 'https://blog-link-monitoring.drluo.top';
  if (apiUrl.endsWith('/')) {
    apiUrl = apiUrl.slice(0, -1);
  }
  const container = document.getElementById('monitoring-container');
  const timezone = 'Asia/Shanghai';
  const timeFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // 初始化：获取并显示数据
  fetchAndRenderData();

  /**
   * 获取并渲染监控数据
   */
  async function fetchAndRenderData() {
    if (!container) return;

    try {
      // 1. 请求所有监控数据
      const response = await fetch(`${apiUrl}/api/data`);
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const result = await response.json();

      // 2. 清空加载提示
      container.innerHTML = '';

      if (!result.success || !result.data || result.data.length === 0) {
        container.innerHTML = '<div class="none-message">暂无监控数据</div>';
        return;
      }

      // 3. 渲染每个站点 (反转数组以调整为顺序显示)
      result.data.reverse().forEach(linkData => {
        const itemEl = createMonitorItem(linkData);
        container.appendChild(itemEl);
      });
      
      // 4. 初始化历史记录模态框
      initHistoryModal();
      
      // 5. 获取并渲染最近30天状态条
      fetchRecentStats();

    } catch (error) {
      console.error('获取监控数据失败:', error);
      container.innerHTML = `<div class="error-message">加载失败: ${error.message}</div>`;
    }
  }

  /**
   * 创建监控卡片
   * @param {Object} data - 后端返回的完整链接对象
   */
  function createMonitorItem(data) {
    const itemEl = document.createElement('div');
    itemEl.className = `monitor-item ${data.available ? 'status-available' : 'status-unavailable'}`;
    itemEl.dataset.url = data.url;
    
    // --- 顶部：站点信息 (Header) ---
    const headerEl = document.createElement('div');
    headerEl.className = 'site-header';
    
    // 左侧：头像 + 信息
    const leftEl = document.createElement('div');
    leftEl.className = 'site-header-left';
    
    // 头像
    const avatarEl = document.createElement('div');
    avatarEl.className = 'site-avatar';
    const imgEl = document.createElement('img');
    const defaultAvatarDataURI = "https://www.drluo.top/img/err_avatar.webp";
    const errorAvatarDataURI = "https://www.drluo.top/img/err_avatar.webp";
    
    imgEl.src = data.avatar || defaultAvatarDataURI; 
    imgEl.alt = data.title || 'Unknown Site';
    imgEl.onerror = () => { imgEl.src = errorAvatarDataURI; };
    avatarEl.appendChild(imgEl);
    leftEl.appendChild(avatarEl);
    
    // 文本信息
    const metaEl = document.createElement('div');
    metaEl.className = 'site-meta';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'site-title';
    titleEl.textContent = data.title || data.url;
    titleEl.title = data.title || data.url; // Tooltip
    metaEl.appendChild(titleEl);
    
    const urlEl = document.createElement('a');
    urlEl.className = 'site-url';
    urlEl.href = data.url;
    urlEl.target = '_blank';
    urlEl.rel = 'noopener noreferrer';
    urlEl.textContent = data.url;
    urlEl.title = data.url; // Tooltip
    metaEl.appendChild(urlEl);
    
    leftEl.appendChild(metaEl);
    headerEl.appendChild(leftEl);

    // 右侧：历史按钮
    const rightEl = document.createElement('div');
    rightEl.className = 'site-header-right';

    // 历史按钮
    const historyBtn = document.createElement('button');
    historyBtn.className = 'history-btn';
    historyBtn.title = '查看历史记录';
    historyBtn.innerHTML = '<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" /><path d="M686.7 638.6L544.1 535.5V288c0-4.4-3.6-8-8-8H456c-4.4 0-8 3.6-8 8v320c0 3.3 1.9 6.4 5 7.8 0.9 0.4 1.9 0.6 2.8 0.6 2.2 0 4.4-0.9 6-2.4l196.5-142c3.5-2.5 4.4-7.4 1.8-10.9-2.5-3.6-7.4-4.5-10.9-1.9z" /></svg>';
    historyBtn.onclick = (e) => {
      e.stopPropagation();
      openHistoryModal(data);
    };
    rightEl.appendChild(historyBtn);
    
    headerEl.appendChild(rightEl);
    itemEl.appendChild(headerEl);

    // --- 中部：截图 (新增) ---
    if (data.screenshot) {
      const screenshotEl = document.createElement('div');
      screenshotEl.className = 'site-screenshot';
      const screenImg = document.createElement('img');
      screenImg.src = data.screenshot;
      screenImg.loading = 'lazy';
      screenImg.alt = `Screenshot of ${data.title}`;
      screenshotEl.appendChild(screenImg);
      itemEl.appendChild(screenshotEl);
    }

    // --- 每日状态条 ---
    const dailyStatusEl = document.createElement('div');
    dailyStatusEl.className = 'daily-status-container';
    dailyStatusEl.innerHTML = '<div class="daily-status-loading"></div>';
    itemEl.appendChild(dailyStatusEl);

    // --- 底部：详细状态 (已移除) ---
    
    return itemEl;
  }

  // --- 历史记录模态框相关 ---
  let historyModal, historyModalContent, loadMoreBtn;
  let currentHistoryUrl = '';
  let currentHistoryPage = 1;
  let isLoadingHistory = false;

  function initHistoryModal() {
    // 检查是否已存在
    if (document.getElementById('history-modal')) return;

    // 创建模态框 DOM
    const modalHtml = `
      <div id="history-modal" class="history-modal">
        <div class="history-modal-content">
          <div class="history-modal-header">
            <div class="history-modal-title">历史记录</div>
            <button class="history-modal-close">&times;</button>
          </div>
          <div class="history-modal-body">
            <ul class="history-list"></ul>
            <div class="load-more-container" style="display:none">
              <button class="load-more-btn">加载更多</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    historyModal = document.getElementById('history-modal');
    historyModalContent = historyModal.querySelector('.history-list');
    loadMoreBtn = historyModal.querySelector('.load-more-btn');

    // 绑定事件
    historyModal.querySelector('.history-modal-close').onclick = closeHistoryModal;
    historyModal.onclick = (e) => {
      if (e.target === historyModal) closeHistoryModal();
    };
    loadMoreBtn.onclick = loadMoreHistory;
  }

  function openHistoryModal(data) {
    if (!historyModal) initHistoryModal();
    
    currentHistoryUrl = data.url;
    currentHistoryPage = 1;
    historyModal.querySelector('.history-modal-title').textContent = `${data.title} - 历史记录`;
    historyModalContent.innerHTML = '';
    historyModal.querySelector('.load-more-container').style.display = 'none';
    
    historyModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // 禁止背景滚动
    
    loadHistoryData();
  }

  function closeHistoryModal() {
    if (historyModal) {
      historyModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  async function loadHistoryData() {
    if (isLoadingHistory) return;
    isLoadingHistory = true;
    

    if (currentHistoryPage === 1) {
      historyModalContent.innerHTML = '<div class="loading-message">加载中...</div>';
    } else {
      loadMoreBtn.textContent = '加载中...';
    }

    try {
      // 1. 获取最近30天数据 (使用 /api/recent-stats 接口)
      const response = await fetch(`${apiUrl}/api/recent-stats?url=${encodeURIComponent(currentHistoryUrl)}`);
      const result = await response.json();
      
      if (currentHistoryPage === 1) {
        historyModalContent.innerHTML = '';
      }

      if (result.success && result.data && Array.isArray(result.data.stats)) {
        const stats = result.data.stats;
        
        // 2. 按月份聚合数据
        const monthlyStats = {};
        
        stats.forEach(dayStat => {
          const month = dayStat.date.substring(0, 7); // YYYY-MM
          
          if (!monthlyStats[month]) {
            monthlyStats[month] = {
              month: month,
              totalChecks: 0,
              successfulChecks: 0,
              failedChecks: 0,
              totalResponseTime: 0
            };
          }
          
          monthlyStats[month].totalChecks += dayStat.totalChecks;
          monthlyStats[month].successfulChecks += dayStat.successfulChecks;
          monthlyStats[month].failedChecks += dayStat.failedChecks;
          monthlyStats[month].totalResponseTime += dayStat.totalResponseTime;
        });
        
        // 转换为数组并按月份倒序排序
        const monthlySummary = Object.values(monthlyStats).sort((a, b) => b.month.localeCompare(a.month));
        
        // 3. 渲染月度统计
        if (monthlySummary.length > 0) {
          const summaryTitle = document.createElement('li');
          summaryTitle.className = 'history-section-title';
          summaryTitle.textContent = '月度存活率统计 (最近30天)';
          historyModalContent.appendChild(summaryTitle);

          monthlySummary.forEach(summary => {
            // 计算可用率
            const uptime = summary.totalChecks > 0 
              ? (summary.successfulChecks / summary.totalChecks) * 100 
              : 0;
            
            const item = document.createElement('li');
            item.className = 'history-item history-monthly';
            
            // 根据可用率设置颜色
            let statusClass = 'status-unknown';
            if (uptime >= 100) statusClass = 'success';
            else if (uptime >= 95) statusClass = 'warning';
            else statusClass = 'fail';

            item.classList.add(statusClass);

            item.innerHTML = `
              <div class="history-time" style="margin-right: 15px;">${summary.month}</div>
              <div class="history-status" style="flex:2; margin-right: 15px;">
                 <div class="progress-bar-bg" style="width:100%; height:8px; background:#eee; border-radius:4px; overflow:hidden;">
                    <div class="progress-bar-fill" style="width:${uptime}%; height:100%; background:${uptime >= 100 ? '#10b981' : (uptime >= 90 ? '#f59e0b' : '#ef4444')}"></div>
                 </div>
              </div>
              <div class="history-meta" style="flex:1; text-align:right;">
                <span style="font-weight:bold; color:${uptime >= 100 ? '#10b981' : (uptime >= 90 ? '#f59e0b' : '#ef4444')}">${formatPercentage(uptime)}</span>
              </div>
            `;
            historyModalContent.appendChild(item);
          });
        } else {
           historyModalContent.innerHTML = '<div class="none-message">暂无月度统计数据</div>';
        }
        
        // 4. 渲染每日详细数据 (作为补充，因为最近30天数据量不大，可以展示)
        if (stats.length > 0) {
          const detailTitle = document.createElement('li');
          detailTitle.className = 'history-section-title';
          detailTitle.textContent = '每日明细';
          detailTitle.style.marginTop = '20px';
          historyModalContent.appendChild(detailTitle);
          
          // 按日期倒序排列
          const sortedStats = [...stats].sort((a, b) => b.date.localeCompare(a.date));
          
          sortedStats.forEach(dayStat => {
             const uptime = dayStat.totalChecks > 0 
              ? (dayStat.successfulChecks / dayStat.totalChecks) * 100 
              : 0;
             const avgTime = dayStat.totalChecks > 0 
              ? Math.round(dayStat.totalResponseTime / dayStat.totalChecks) 
              : 0;
              
             const item = document.createElement('li');
             // 根据可用率设置简单的状态类
             item.className = `history-item ${uptime >= 100 ? 'success' : (uptime > 0 ? 'warning' : 'fail')}`;
             
             item.innerHTML = `
               <div class="history-time">${dayStat.date}</div>
               <div class="history-status">${uptime >= 100 ? '正常' : (uptime > 0 ? '部分异常' : '异常')}</div>
               <div class="history-meta">
                 <span>${formatPercentage(uptime)}</span> | 
                 <span>${avgTime}ms</span>
               </div>
             `;
             historyModalContent.appendChild(item);
          });
        }

      } else {
        historyModalContent.innerHTML = '<div class="none-message">暂无历史记录</div>';
      }

      // 隐藏加载更多按钮 (因为是一次性获取所有 recent-stats)
      const loadMoreContainer = historyModal.querySelector('.load-more-container');
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';

    } catch (error) {
      console.error('加载历史记录失败:', error);
      if (currentHistoryPage === 1) {
        historyModalContent.innerHTML = `<div class="error-message">加载失败: ${error.message}</div>`;
      } else {
        loadMoreBtn.textContent = '加载失败，点击重试';
      }
    } finally {
      isLoadingHistory = false;
    }
  }

  function loadMoreHistory() {
    currentHistoryPage++;
    loadHistoryData();
  }

  /**
   * 获取并渲染最近30天状态 (使用 /api/recent-stats 接口 - 统一获取)
   */
  async function fetchRecentStats() {
    const items = document.querySelectorAll('.monitor-item');
    if (items.length === 0) return;

    // 生成最近30天的日期数组 (包含今天)
    const recentDates = [];
    const today = new Date();
    // 使用 Asia/Shanghai 时区处理日期，避免时区偏差
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const parts = formatter.formatToParts(d);
      const map = {};
      parts.forEach(p => { if(p.type !== 'literal') map[p.type] = p.value });
      recentDates.push(`${map.year}-${map.month}-${map.day}`);
    }

    try {
      // 统一获取所有站点的最近30天数据
      const response = await fetch(`${apiUrl}/api/recent-stats`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        // 创建数据映射 Map<url, statsData>
        const statsMap = new Map();
        result.data.forEach(item => {
          if (item.url) {
            statsMap.set(item.url, item);
          }
        });

        // 遍历页面上的卡片并渲染
        items.forEach(item => {
          const url = item.dataset.url;
          const statusContainer = item.querySelector('.daily-status-container');
          if (!statusContainer) return;

          const itemData = statsMap.get(url);
          if (itemData) {
            renderDailyStatusBar(statusContainer, itemData, recentDates);
          } else {
            renderEmptyStatusBar(statusContainer, recentDates);
          }
        });
      } else {
        // 获取失败，渲染空状态
        items.forEach(item => {
          const statusContainer = item.querySelector('.daily-status-container');
          if (statusContainer) renderEmptyStatusBar(statusContainer, recentDates);
        });
      }
    } catch (error) {
      console.error('批量获取最近30天数据失败:', error);
      // 出错时渲染空状态
      items.forEach(item => {
        const statusContainer = item.querySelector('.daily-status-container');
        if (statusContainer) renderEmptyStatusBar(statusContainer, recentDates);
      });
    }
  }

  function renderDailyStatusBar(container, data, dateList) {
    container.innerHTML = ''; // 清空加载动画
    
    // 准备数据 Map
    const statsMap = {};
    if (data && Array.isArray(data.stats)) {
      data.stats.forEach(stat => {
        statsMap[stat.date] = stat;
      });
    }

    // 生成每一天的条纹
    dateList.forEach(dateStr => {
      const dayStat = statsMap[dateStr];
      
      const strip = document.createElement('div');
      strip.className = 'daily-status-item';
      
      if (dayStat) {
        // 计算当天可用率
        const uptime = dayStat.totalChecks > 0 
          ? (dayStat.successfulChecks / dayStat.totalChecks) 
          : 0;
        
        if (uptime >= 1.0) {
          strip.classList.add('status-success');
        } else if (uptime > 0) {
          strip.classList.add('status-partial');
        } else {
          strip.classList.add('status-fail');
        }
        
        const uptimePercent = Math.round(uptime * 100);
        const avgTime = dayStat.totalChecks > 0 
          ? Math.round(dayStat.totalResponseTime / dayStat.totalChecks) 
          : 0;

        // Tooltip 内容
        strip.innerHTML = `
          <div class="daily-status-tooltip">
            ${dateStr}<br>
            可用率: ${uptimePercent}%<br>
            响应: ${avgTime}ms<br>
            检测: ${dayStat.totalChecks}次
          </div>
        `;
      } else {
        strip.classList.add('status-none'); // 无数据
        strip.innerHTML = `<div class="daily-status-tooltip">${dateStr}<br>无数据</div>`;
      }
      
      container.appendChild(strip);
    });
  }

  function renderEmptyStatusBar(container, dateList) {
    container.innerHTML = '';
    dateList.forEach(dateStr => {
      const strip = document.createElement('div');
      strip.className = 'daily-status-item status-none';
      strip.innerHTML = `<div class="daily-status-tooltip">${dateStr}<br>无数据</div>`;
      container.appendChild(strip);
    });
  }

  // --- 废弃旧的 fetchCurrentMonthStats 函数 ---

  // --- 工具函数 ---

  function formatTime(date) {
    if (isNaN(date.getTime())) return '-';
    return timeFormatter.format(date).replace(', ', ' ');
  }

  function padZero(num) {
    return num < 10 ? `0${num}` : num;
  }

  function getShanghaiYearMonth() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit'
    }).formatToParts(new Date());
    const map = {};
    parts.forEach(part => {
      if (part.type !== 'literal') {
        map[part.type] = part.value;
      }
    });
    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10)
    };
  }

  function formatResponseTime(ms) {
    if (!ms && ms !== 0) return '-';
    if (ms < 1000) {
      return `${ms}ms`;
    } else {
      return `${(ms / 1000).toFixed(2)}s`;
    }
  }

  function formatPercentage(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${Number(value).toFixed(2)}%`;
  }

  // --- 历史记录模态框 UI 逻辑补充 ---
  // 确保模态框关闭按钮和点击背景关闭生效
  // 已经在 initHistoryModal 中绑定
});
