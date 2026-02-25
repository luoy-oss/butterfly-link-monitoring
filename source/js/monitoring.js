/**
 * 监控页面脚本
 * 适配新的 MongoDB 数据结构：{ title, avatar, screenshot, status, available }
 */

document.addEventListener('DOMContentLoaded', function() {
  const monitoringConfig = window.MONITORING_CONFIG || {};
  const apiUrl = monitoringConfig.apiUrl || 'https://blog-link-monitoring.drluo.top';
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

      // 3. 渲染每个站点
      result.data.forEach(linkData => {
        const itemEl = createMonitorItem(linkData);
        container.appendChild(itemEl);
      });
      
      // 4. 初始化历史记录模态框
      initHistoryModal();
      
      // 5. 获取并渲染当月每日状态条
      fetchMonthlyStats();

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
    itemEl.className = 'monitor-item';
    itemEl.dataset.url = data.url; // 添加 data-url 属性
    
    // --- 顶部：站点信息 ---
    const siteInfoEl = document.createElement('div');
    siteInfoEl.className = 'site-info';
    
    // 头像
    const avatarEl = document.createElement('div');
    avatarEl.className = 'site-avatar';
    const imgEl = document.createElement('img');
    // 使用数据中的 avatar，如果没有则使用默认图或占位
    imgEl.src = data.avatar || 'https://via.placeholder.com/48'; 
    imgEl.alt = data.title || 'Unknown Site';
    imgEl.onerror = () => { imgEl.src = 'https://via.placeholder.com/48?text=Err'; }; // 头像加载失败回退
    avatarEl.appendChild(imgEl);
    siteInfoEl.appendChild(avatarEl);
    
    // 文本信息
    const metaEl = document.createElement('div');
    metaEl.className = 'site-meta';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'site-title';
    titleEl.textContent = data.title || data.url;
    metaEl.appendChild(titleEl);
    
    const urlEl = document.createElement('a');
    urlEl.className = 'site-url';
    urlEl.href = data.url;
    urlEl.target = '_blank';
    urlEl.rel = 'noopener noreferrer';
    urlEl.textContent = data.url;
    metaEl.appendChild(urlEl);
    
    siteInfoEl.appendChild(metaEl);
    
    // 状态徽章 (放在右上角或跟随标题)
    const statusBadge = document.createElement('div');
    statusBadge.className = `status-badge ${data.available ? 'available' : 'unavailable'}`;
    statusBadge.textContent = data.available ? '正常' : '异常';
    siteInfoEl.appendChild(statusBadge);

    // 历史按钮
    const historyBtn = document.createElement('button');
    historyBtn.className = 'history-btn';
    historyBtn.title = '查看历史记录';
    historyBtn.innerHTML = '<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" /><path d="M686.7 638.6L544.1 535.5V288c0-4.4-3.6-8-8-8H456c-4.4 0-8 3.6-8 8v320c0 3.3 1.9 6.4 5 7.8 0.9 0.4 1.9 0.6 2.8 0.6 2.2 0 4.4-0.9 6-2.4l196.5-142c3.5-2.5 4.4-7.4 1.8-10.9-2.5-3.6-7.4-4.5-10.9-1.9z" /></svg>';
    historyBtn.onclick = (e) => {
      e.stopPropagation();
      openHistoryModal(data);
    };
    siteInfoEl.appendChild(historyBtn);

    itemEl.appendChild(siteInfoEl);

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

    // --- 底部：详细状态 ---
    const statusDetailEl = document.createElement('div');
    statusDetailEl.className = 'status-detail';
    
    const metricsHtml = `
      <div class="metric-item">
        <span class="label">状态码:</span>
        <span class="value">${data.status || '-'}</span>
      </div>
      <div class="metric-item">
        <span class="label">响应时间:</span>
        <span class="value">${formatResponseTime(data.responseTime)}</span>
      </div>
      <div class="metric-item">
        <span class="label">检测时间:</span>
        <span class="value">${formatTime(new Date(data.checkedAt))}</span>
      </div>
    `;
    statusDetailEl.innerHTML = metricsHtml;
    itemEl.appendChild(statusDetailEl);

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
      const response = await fetch(`${apiUrl}/api/history?url=${encodeURIComponent(currentHistoryUrl)}&page=${currentHistoryPage}&limit=20`);
      const result = await response.json();

      if (currentHistoryPage === 1) {
        historyModalContent.innerHTML = '';
      }

      if (result.success && result.data.length > 0) {
        result.data.forEach(log => {
          const item = document.createElement('li');
          item.className = `history-item ${log.available ? 'success' : 'fail'}`;
          item.innerHTML = `
            <div class="history-time">${formatTime(new Date(log.checkedAt))}</div>
            <div class="history-status">${log.available ? '正常' : '异常'}</div>
            <div class="history-meta">
              <span>${log.status || '-'}</span> | 
              <span>${formatResponseTime(log.responseTime)}</span>
            </div>
          `;
          historyModalContent.appendChild(item);
        });

        // 处理分页
        const hasMore = result.pagination && result.pagination.hasMore;
        const loadMoreContainer = historyModal.querySelector('.load-more-container');
        loadMoreContainer.style.display = hasMore ? 'block' : 'none';
        if (hasMore) {
          loadMoreBtn.textContent = '加载更多';
        }
      } else if (currentHistoryPage === 1) {
        historyModalContent.innerHTML = '<div class="none-message">暂无历史记录</div>';
      }
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
   * 获取并渲染月度每日状态
   */
  async function fetchMonthlyStats() {
    try {
      // 默认获取当前月
      const response = await fetch(`${apiUrl}/api/monthly`);
      const result = await response.json();

      if (!result.success || !result.data) return;

      // 解析后端返回的月份 (例如 "2026-02")，如果未返回则回退到当前时间
      let currentYear, currentMonth;
      if (result.month) {
        const parts = result.month.split('-');
        currentYear = parseInt(parts[0], 10);
        currentMonth = parseInt(parts[1], 10);
      } else {
        const parts = getShanghaiYearMonth();
        currentYear = parts.year;
        currentMonth = parts.month;
      }

      // 计算该月份的总天数
      // new Date(year, month, 0) 获取的是该月最后一天
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

      // 遍历页面上所有的卡片
      const items = document.querySelectorAll('.monitor-item');
      items.forEach(item => {
        const url = item.dataset.url;
        const statusContainer = item.querySelector('.daily-status-container');
        if (!statusContainer) return;

        // 获取该 URL 的历史数据 (数组)
        const historyData = result.data[url] || [];
        // 转换为 Map 方便按日期查找: "2023-10-01" -> { uptime: 1, count: 20 }
        const historyMap = {};
        historyData.forEach(d => historyMap[d.date] = d);

        statusContainer.innerHTML = ''; // 清空加载动画

        // 生成每一天的条纹
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${currentYear}-${padZero(currentMonth)}-${padZero(day)}`;
          const dayData = historyMap[dateStr];
          
          const strip = document.createElement('div');
          strip.className = 'daily-status-item';
          
          // 判断颜色状态
          if (dayData) {
            if (dayData.uptime >= 1.0) {
              strip.classList.add('status-success'); // 全绿
            } else if (dayData.uptime > 0) {
              strip.classList.add('status-partial'); // 部分失败 (橙色/黄色)
            } else {
              strip.classList.add('status-fail');    // 全红
            }
            
            // Tooltip 内容
            const uptimePercent = Math.round(dayData.uptime * 100);
            strip.innerHTML = `
              <div class="daily-status-tooltip">
                ${dateStr}<br>
                可用性: ${uptimePercent}%<br>
                检测次数: ${dayData.count}
              </div>
            `;
          } else {
            strip.classList.add('status-none'); // 无数据 (灰色)
            strip.innerHTML = `<div class="daily-status-tooltip">${dateStr}<br>无数据</div>`;
          }
          
          statusContainer.appendChild(strip);
        }
      });

    } catch (error) {
      console.error('获取月度状态失败:', error);
    }
  }

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

  // --- 历史记录模态框 UI 逻辑补充 ---
  // 确保模态框关闭按钮和点击背景关闭生效
  // 已经在 initHistoryModal 中绑定
});
