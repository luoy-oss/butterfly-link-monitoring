/**
 * 监控页面脚本
 * 用于获取友链状态并显示监控数据
 */

document.addEventListener('DOMContentLoaded', function() {
  // 获取配置信息
  const monitoringConfig = window.MONITORING_CONFIG || {};
  const apiUrl = monitoringConfig.apiUrl || 'https://blog-link-monitoring.drluo.top';
  const friend_link_url = monitoringConfig.friend_link_url || '';
  const limit = monitoringConfig.limit || 10;
  const days = monitoringConfig.days || 30;
  const additionalLinks = monitoringConfig.links || [];
  
  /**
   * 创建空的监控项元素
   * @param {Object} link 友链数据
   * @returns {HTMLElement} 监控项元素
   */
  function createEmptyMonitorItem(link) {
    const itemEl = document.createElement('div');
    itemEl.className = 'monitor-item';
    
    // 站点信息
    const siteInfoEl = document.createElement('div');
    siteInfoEl.className = 'site-info';
    
    // 头像
    const avatarEl = document.createElement('div');
    avatarEl.className = 'site-avatar';
    if (link.avatar) {
      const imgEl = document.createElement('img');
      imgEl.src = link.avatar;
      imgEl.alt = link.title;
      avatarEl.appendChild(imgEl);
    }
    siteInfoEl.appendChild(avatarEl);
    
    // 站点元数据
    const metaEl = document.createElement('div');
    metaEl.className = 'site-meta';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'site-title';
    titleEl.textContent = link.title;
    metaEl.appendChild(titleEl);
    
    const urlEl = document.createElement('div');
    urlEl.className = 'site-url';
    urlEl.textContent = link.url;
    metaEl.appendChild(urlEl);
    
    siteInfoEl.appendChild(metaEl);
    itemEl.appendChild(siteInfoEl);
    
    // 状态信息（加载中）
    const statusEl = document.createElement('div');
    statusEl.className = 'site-status';
    
    // 状态信息
    const statusInfoEl = document.createElement('div');
    statusInfoEl.className = 'status-info loading';
    statusInfoEl.innerHTML = '<span class="loading-message">正在获取监控数据...</span>';
    statusEl.appendChild(statusInfoEl);
    
    // 创建固定数量的灰色状态格
    const statusBarEl = document.createElement('div');
    statusBarEl.className = 'status-bar';
    
    for (let i = 0; i < days; i++) {
      const barItemEl = document.createElement('div');
      barItemEl.className = 'bar-item no-data';
      barItemEl.title = '暂无监控数据';
      if (i > 0) {
        barItemEl.classList.add('gap');
      }
      statusBarEl.appendChild(barItemEl);
    }
    
    statusEl.appendChild(statusBarEl);
    itemEl.appendChild(statusEl);
    
    return itemEl;
  }
  
  // 获取友链数据并合并额外的监测链接
  getFriendLinks().then(friendLinks => {
    // 合并配置文件中的额外链接
    const extraLinks = additionalLinks.map(link => ({
      title: link.title,
      url: link.url,
      avatar: link.avatar,
      description: link.description
    }));
    // 创建监控面板并立即显示所有链接
    const allLinks = [...extraLinks, ...friendLinks];
    const container = document.getElementById('monitoring-container');
    if (!container) return;

    // 清空容器
    container.innerHTML = '';
    
    // 为每个链接创建面板并异步加载状态
    allLinks.forEach(link => {
      const itemEl = createEmptyMonitorItem(link);
      container.appendChild(itemEl);
      
      // 异步加载监控数据
      getMonitoringData(link).then(updatedItemEl => {
        if (updatedItemEl) {
          container.replaceChild(updatedItemEl, itemEl);
        }
      }).catch(error => {
        console.error(`获取 ${link.url} 的监控数据失败:`, error);
        itemEl.querySelector('.status-bar').innerHTML = `<div class="error-message">获取监控数据失败: ${error.message}</div>`;
      });
    });
  }).catch(error => {
    console.error('获取友链数据失败:', error);
    document.getElementById('monitoring-container').innerHTML = `<div class="error-message">获取友链数据失败: ${error.message}</div>`;
  });
  
  /**
   * 获取友链数据
   * @returns {Promise<Array>} 友链数据数组
   */
  async function getFriendLinks() {
    if (!friend_link_url) return [];
    try {
      const response = await fetch(friend_link_url);
      if (!response.ok) {
        throw new Error(`GitHub API 请求失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 解析友链数据
      return data.map(issue => {
        // 尝试从issue.body中提取JSON数据
        try {
          const bodyContent = issue.body || '';
          const jsonMatch = bodyContent.match(/```json\n([\s\S]*?)\n```/);
          
          if (jsonMatch && jsonMatch[1]) {
            const linkData = JSON.parse(jsonMatch[1]);
            return {
              title: linkData.title || issue.title,
              url: linkData.url || issue.title,
              avatar: linkData.avatar || '',
              description: linkData.description || ''
            };
          }
          
          // 如果没有找到JSON数据，使用issue标题作为URL
          return {
            title: issue.title.replace(/https?:\/\//, '').replace(/\/$/, ''),
            url: issue.title,
            avatar: '',
            description: ''
          };
        } catch (e) {
          console.error('解析友链数据失败:', e);
          return {
            title: issue.title.replace(/https?:\/\//, '').replace(/\/$/, ''),
            url: issue.title,
            avatar: '',
            description: ''
          };
        }
      });
    } catch (error) {
      console.error('获取友链数据失败:', error);
      throw error;
    }
  }
  
  /**
   * 创建监控面板
   * @param {Array} friendLinks 友链数据数组
   */
  function createMonitoringPanel(friendLinks) {
    const container = document.getElementById('monitoring-container');
    if (!container) return;
    
    // 清空容器
    container.innerHTML = '';
    
    // 创建加载提示
    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading-message';
    loadingEl.textContent = '正在获取监控数据...';
    container.appendChild(loadingEl);
    
    // 处理每个友链
    const promises = friendLinks.map(link => getMonitoringData(link));
    
    Promise.all(promises).then(results => {
      // 移除加载提示
      container.removeChild(loadingEl);
      
      // 显示监控数据
      results.forEach(result => {
        if (result) {
          container.appendChild(result);
        }
      });
    }).catch(error => {
      console.error('获取监控数据失败:', error);
      loadingEl.textContent = `获取监控数据失败: ${error.message}`;
      loadingEl.className = 'error-message';
    });
  }
  
  /**
   * 获取单个网站的监控数据
   * @param {Object} link 友链数据
   * @returns {Promise<HTMLElement>} 监控面板元素
   */
  async function getMonitoringData(link) {
    if (!link || !link.url) return null;
    
    try {
      // 构建API URL
      const url = link.url.startsWith('http') ? link.url : `https://${link.url}`;
      const monitorUrl = `${apiUrl}/api/data?url=${encodeURIComponent(url)}&limit=${limit}`;
      
      // 设置超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
      
      const response = await fetch(monitorUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`监控API请求失败: ${response.status}`);
      }
      
      const monitorData = await response.json();
      
      // 检查数据是否为空
      if (monitorData.success && monitorData.count === 0) {
        const emptyItem = createEmptyMonitorItem(link);
        const statusInfoEl = emptyItem.querySelector('.status-info');
        statusInfoEl.classList.remove('loading');
        statusInfoEl.innerHTML = '<span class="none-message">暂无监控数据</span>';
        return emptyItem;
      }
      
      // 创建监控面板元素
      return createMonitorItem(link, monitorData);
    } catch (error) {
      console.error(`获取 ${link.url} 的监控数据失败:`, error);
      const errorItem = createEmptyMonitorItem(link);
      const statusInfoEl = errorItem.querySelector('.status-info');
      statusInfoEl.classList.remove('loading');
      statusInfoEl.innerHTML = `<span class="error-message">${error.name === 'AbortError' ? '请求超时' : '获取监控数据失败'}</span>`;
      return errorItem;
    }
  }
  
  /**
   * 创建监控项元素
   * @param {Object} link 友链数据
   * @param {Object} monitorData 监控数据
   * @returns {HTMLElement} 监控项元素
   */
  function createMonitorItem(link, monitorData) {
    if (!monitorData || !monitorData.data || !monitorData.data.length) {
      return null;
    }
    
    const itemEl = document.createElement('div');
    itemEl.className = 'monitor-item';
    
    // 站点信息
    const siteInfoEl = document.createElement('div');
    siteInfoEl.className = 'site-info';
    
    // 头像
    const avatarEl = document.createElement('div');
    avatarEl.className = 'site-avatar';
    if (link.avatar) {
      const imgEl = document.createElement('img');
      imgEl.src = link.avatar;
      imgEl.alt = link.title;
      avatarEl.appendChild(imgEl);
    }
    siteInfoEl.appendChild(avatarEl);
    
    // 站点元数据
    const metaEl = document.createElement('div');
    metaEl.className = 'site-meta';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'site-title';
    titleEl.textContent = link.title;
    metaEl.appendChild(titleEl);
    
    const urlEl = document.createElement('div');
    urlEl.className = 'site-url';
    urlEl.textContent = link.url;
    metaEl.appendChild(urlEl);
    
    siteInfoEl.appendChild(metaEl);
    itemEl.appendChild(siteInfoEl);
    
    // 状态信息
    const statusEl = document.createElement('div');
    statusEl.className = 'site-status';
    
    // 最新状态
    const latestData = monitorData.data[0];
    const isAvailable = latestData.available;
    
    const statusInfoEl = document.createElement('div');
    statusInfoEl.className = `status-info ${isAvailable ? 'available' : 'unavailable'}`;
    statusInfoEl.innerHTML = `
      <span class="status-badge">${isAvailable ? '正常' : '异常'}</span>
      <span class="response-time">响应时间: ${formatResponseTime(latestData.responseTime)}</span>
      <span class="checked-time">检测时间: ${formatTime(new Date(latestData.timestamp || latestData.checkedAt))}</span>
    `;
    statusEl.appendChild(statusInfoEl);
    
    // 状态条
    const statusBarEl = document.createElement('div');
    statusBarEl.className = 'status-bar';
    
    // 获取最近days天的数据
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // 创建状态条项
    if (monitorData.data.length === 0) {
      // 无数据时显示灰色状态条
      const barItemEl = document.createElement('div');
      barItemEl.className = 'bar-item no-data';
      barItemEl.title = '暂无监控数据';
      statusBarEl.appendChild(barItemEl);
    } else {
      // 按时间倒序排序
      const sortedData = monitorData.data
        .filter(item => new Date(item.checkedAt) >= startDate)
        .sort((a, b) => new Date(b.checkedAt) - new Date(a.checkedAt));
      
      // 创建分割的状态条
      sortedData.forEach((item, index) => {
        const barItemEl = document.createElement('div');
        barItemEl.className = `bar-item ${item.available ? 'available' : 'unavailable'}`;
        barItemEl.title = `${formatTime(new Date(item.checkedAt))}: ${item.available ? '正常' : '异常'} (${formatResponseTime(item.responseTime)})`;
        
        // 添加分隔线
        if (index > 0) {
          const prevDate = new Date(sortedData[index - 1].checkedAt);
          const currDate = new Date(item.checkedAt);
          const hoursDiff = (prevDate - currDate) / (1000 * 60 * 60);
          
          if (hoursDiff > 1) {
            barItemEl.classList.add('gap');
          }
        }
        
        statusBarEl.appendChild(barItemEl);
      });
    }
    
    statusEl.appendChild(statusBarEl);
    itemEl.appendChild(statusEl);
    
    return itemEl;
  }
  
  /**
   * 格式化时间
   * @param {Date} date 日期对象
   * @returns {string} 格式化后的时间字符串
   */
  function formatTime(date) {
    return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`;
  }
  
  /**
   * 数字补零
   * @param {number} num 数字
   * @returns {string} 补零后的字符串
   */
  function padZero(num) {
    return num < 10 ? `0${num}` : num;
  }
  
  /**
   * 格式化响应时间
   * @param {number} ms - 毫秒数
   * @returns {string} 格式化后的响应时间
   */
  function formatResponseTime(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    } else {
      return `${(ms / 1000).toFixed(2)}s`;
    }
  }
});