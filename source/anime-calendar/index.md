---
title: 追番追剧日历
date: 2026-03-09 00:00:00
layout: page
---

<div id="anime-calendar-app">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2>追番追剧日历</h2>
    <p>记录和管理你正在追的日剧、韩剧和动漫</p>
  </div>
  
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
    <button id="prev-month" style="padding: 10px 20px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">上个月</button>
    <h3 id="current-month" style="margin: 0;"></h3>
    <button id="next-month" style="padding: 10px 20px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">下个月</button>
  </div>
  
  <div id="calendar-container"></div>
  
  <div style="display: flex; justify-content: center; gap: 20px; margin: 20px 0; padding: 10px; background-color: #f9f9f9; border-radius: 8px;">
    <div style="display: flex; align-items: center; gap: 5px;">
      <div style="width: 20px; height: 20px; background-color: #ff6b6b; border-radius: 4px;"></div>
      <span>日剧/动漫</span>
    </div>
    <div style="display: flex; align-items: center; gap: 5px;">
      <div style="width: 20px; height: 20px; background-color: #4ecdc4; border-radius: 4px;"></div>
      <span>韩剧</span>
    </div>
    <div style="display: flex; align-items: center; gap: 5px;">
      <div style="width: 20px; height: 20px; background-color: #45b7d1; border-radius: 4px;"></div>
      <span>国产剧</span>
    </div>
  </div>
  
  <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
    <h3>添加新剧集</h3>
    
    <div style="margin-bottom: 15px;">
      <button id="weekly-mode-btn" style="padding: 10px 20px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">每周固定时间</button>
      <button id="range-mode-btn" style="padding: 10px 20px; background-color: #f0f0f0; color: #333; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">持续时间段</button>
    </div>
    
    <div id="weekly-form">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 15px;">
        <input type="text" id="weekly-title" placeholder="剧集名称" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <select id="weekly-type" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="">选择类型</option>
          <option value="japanese">日剧/动漫</option>
          <option value="korean">韩剧</option>
          <option value="chinese">国产剧</option>
        </select>
        <select id="weekly-day" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="">选择星期</option>
          <option value="1">周一</option>
          <option value="2">周二</option>
          <option value="3">周三</option>
          <option value="4">周四</option>
          <option value="5">周五</option>
          <option value="6">周六</option>
          <option value="0">周日</option>
        </select>
        <input type="time" id="weekly-time" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <input type="date" id="weekly-start" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <input type="date" id="weekly-end" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <button id="add-weekly-btn" style="padding: 8px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">添加</button>
      </div>
      <p style="font-size: 12px; color: #666; margin-top: 10px;">提示：开始和结束日期可选，不填则永久显示</p>
    </div>
    
    <div id="range-form" style="display: none;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 15px;">
        <input type="text" id="range-title" placeholder="剧集名称" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <select id="range-type" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="">选择类型</option>
          <option value="japanese">日剧/动漫</option>
          <option value="korean">韩剧</option>
          <option value="chinese">国产剧</option>
        </select>
        <input type="date" id="range-start" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <input type="date" id="range-end" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <input type="time" id="range-time" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <button id="add-range-btn" style="padding: 8px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">添加</button>
      </div>
      <p style="font-size: 12px; color: #666; margin-top: 10px;">提示：将在指定日期范围内每天显示</p>
    </div>
  </div>
</div>

<script>
(function() {
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();
  let animeList = JSON.parse(localStorage.getItem('animeList')) || [];
  
  function init() {
    generateCalendar();
    setupEventListeners();
  }
  
  function generateCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    
    let html = '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">';
    
    html += '<thead><tr>';
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    weekdays.forEach(day => {
      html += '<th style="padding: 10px; background-color: #4CAF50; color: white; text-align: center; font-weight: bold; border: 1px solid #ddd;">' + day + '</th>';
    });
    html += '</tr></thead>';
    
    html += '<tbody>';
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    let dayCount = 1;
    let nextMonthDay = 1;
    
    const today = new Date();
    
    for (let week = 0; week < 6; week++) {
      html += '<tr>';
      
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const cellIndex = week * 7 + dayOfWeek;
        
        if (cellIndex < startDayOfWeek) {
          const day = prevMonthLastDay - startDayOfWeek + cellIndex + 1;
          html += '<td style="padding: 10px; border: 1px solid #e0e0e0; background-color: #f0f0f0; opacity: 0.5; min-height: 80px; vertical-align: top;">';
          html += '<div style="font-size: 14px; color: #999; margin-bottom: 5px;">' + day + '</div>';
          html += '</td>';
        } else if (dayCount <= lastDay.getDate()) {
          const isToday = today.getFullYear() === currentYear && 
                          today.getMonth() === currentMonth && 
                          today.getDate() === dayCount;
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          html += '<td style="padding: 10px; border: 1px solid #e0e0e0; background-color: ' + (isWeekend ? '#f0f8ff' : '#f9f9f9') + '; ' + (isToday ? 'border: 2px solid #4CAF50;' : '') + ' min-height: 80px; vertical-align: top;">';
          html += '<div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 5px;">' + dayCount + '</div>';
          
          const date = new Date(currentYear, currentMonth, dayCount);
          const dayAnimes = getAnimesForDate(date);
          
          dayAnimes.forEach(anime => {
            const colorMap = { japanese: '#ff6b6b', korean: '#4ecdc4', chinese: '#45b7d1' };
            html += '<div style="background-color: #fff; border-radius: 4px; padding: 4px 6px; margin-bottom: 3px; font-size: 11px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 3px solid ' + colorMap[anime.type] + ';" onclick="showAnimeDetail(\'' + anime.id + '\')">';
            html += anime.title + '<br><small>' + anime.time + '</small>';
            html += '</div>';
          });
          
          html += '</td>';
          dayCount++;
        } else {
          html += '<td style="padding: 10px; border: 1px solid #e0e0e0; background-color: #f0f0f0; opacity: 0.5; min-height: 80px; vertical-align: top;">';
          html += '<div style="font-size: 14px; color: #999; margin-bottom: 5px;">' + nextMonthDay + '</div>';
          html += '</td>';
          nextMonthDay++;
        }
      }
      
      html += '</tr>';
      
      if (dayCount > lastDay.getDate()) break;
    }
    
    html += '</tbody></table>';
    
    container.innerHTML = html;
    
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    document.getElementById('current-month').textContent = currentYear + '年' + monthNames[currentMonth];
  }
  
  function getAnimesForDate(date) {
    const dateStr = formatDate(date);
    const dayOfWeek = date.getDay();
    
    return animeList.filter(anime => {
      if (anime.mode === 'weekly') {
        if (anime.dayOfWeek !== dayOfWeek) return false;
        if (anime.startDate && dateStr < anime.startDate) return false;
        if (anime.endDate && dateStr > anime.endDate) return false;
        return true;
      } else if (anime.mode === 'range') {
        return dateStr >= anime.startDate && dateStr <= anime.endDate;
      }
      return false;
    });
  }
  
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  
  function setupEventListeners() {
    document.getElementById('prev-month').addEventListener('click', function() {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      generateCalendar();
    });
    
    document.getElementById('next-month').addEventListener('click', function() {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      generateCalendar();
    });
    
    document.getElementById('weekly-mode-btn').addEventListener('click', function() {
      document.getElementById('weekly-form').style.display = 'block';
      document.getElementById('range-form').style.display = 'none';
      this.style.backgroundColor = '#4CAF50';
      this.style.color = 'white';
      document.getElementById('range-mode-btn').style.backgroundColor = '#f0f0f0';
      document.getElementById('range-mode-btn').style.color = '#333';
    });
    
    document.getElementById('range-mode-btn').addEventListener('click', function() {
      document.getElementById('weekly-form').style.display = 'none';
      document.getElementById('range-form').style.display = 'block';
      this.style.backgroundColor = '#4CAF50';
      this.style.color = 'white';
      document.getElementById('weekly-mode-btn').style.backgroundColor = '#f0f0f0';
      document.getElementById('weekly-mode-btn').style.color = '#333';
    });
    
    document.getElementById('add-weekly-btn').addEventListener('click', function() {
      const title = document.getElementById('weekly-title').value;
      const type = document.getElementById('weekly-type').value;
      const day = document.getElementById('weekly-day').value;
      const time = document.getElementById('weekly-time').value;
      
      if (!title || !type || !day || !time) {
        alert('请填写完整信息');
        return;
      }
      
      const anime = {
        id: Date.now().toString(),
        mode: 'weekly',
        title: title,
        type: type,
        dayOfWeek: parseInt(day),
        time: time,
        startDate: document.getElementById('weekly-start').value || null,
        endDate: document.getElementById('weekly-end').value || null
      };
      
      animeList.push(anime);
      localStorage.setItem('animeList', JSON.stringify(animeList));
      generateCalendar();
      
      document.getElementById('weekly-title').value = '';
      document.getElementById('weekly-type').value = '';
      document.getElementById('weekly-day').value = '';
      document.getElementById('weekly-time').value = '';
      document.getElementById('weekly-start').value = '';
      document.getElementById('weekly-end').value = '';
    });
    
    document.getElementById('add-range-btn').addEventListener('click', function() {
      const title = document.getElementById('range-title').value;
      const type = document.getElementById('range-type').value;
      const startDate = document.getElementById('range-start').value;
      const endDate = document.getElementById('range-end').value;
      const time = document.getElementById('range-time').value;
      
      if (!title || !type || !startDate || !endDate || !time) {
        alert('请填写完整信息');
        return;
      }
      
      const anime = {
        id: Date.now().toString(),
        mode: 'range',
        title: title,
        type: type,
        startDate: startDate,
        endDate: endDate,
        time: time
      };
      
      animeList.push(anime);
      localStorage.setItem('animeList', JSON.stringify(animeList));
      generateCalendar();
      
      document.getElementById('range-title').value = '';
      document.getElementById('range-type').value = '';
      document.getElementById('range-start').value = '';
      document.getElementById('range-end').value = '';
      document.getElementById('range-time').value = '';
    });
  }
  
  window.showAnimeDetail = function(id) {
    const anime = animeList.find(a => a.id === id);
    if (!anime) return;
    
    const typeNames = { japanese: '日剧/动漫', korean: '韩剧', chinese: '国产剧' };
    let message = '剧集：' + anime.title + '\n';
    message += '类型：' + typeNames[anime.type] + '\n';
    message += '时间：' + anime.time + '\n';
    
    if (anime.mode === 'weekly') {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      message += '每周：' + weekdays[anime.dayOfWeek] + '\n';
      if (anime.startDate) message += '开始：' + anime.startDate + '\n';
      if (anime.endDate) message += '结束：' + anime.endDate + '\n';
    } else {
      message += '日期范围：' + anime.startDate + ' 至 ' + anime.endDate + '\n';
    }
    
    alert(message);
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>