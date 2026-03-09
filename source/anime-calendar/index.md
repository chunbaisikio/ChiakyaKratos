---
title: 追番追剧日历
date: 2026-03-09 00:00:00
layout: page
---

<style>
  .calendar-container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
  }
  
  .calendar-header {
    text-align: center;
    margin-bottom: 30px;
  }
  
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 10px;
    margin-bottom: 30px;
  }
  
  .calendar-day {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 15px;
    min-height: 150px;
    background-color: #f9f9f9;
  }
  
  .calendar-day.weekend {
    background-color: #f0f8ff;
  }
  
  .day-header {
    font-weight: bold;
    margin-bottom: 10px;
    text-align: center;
  }
  
  .day-number {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 10px;
  }
  
  .anime-item {
    background-color: #fff;
    border-radius: 4px;
    padding: 5px;
    margin-bottom: 5px;
    font-size: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  .anime-item.japanese {
    border-left: 3px solid #ff6b6b;
  }
  
  .anime-item.korean {
    border-left: 3px solid #4ecdc4;
  }
  
  .anime-item.chinese {
    border-left: 3px solid #45b7d1;
  }
  
  .add-anime {
    margin-top: 30px;
    padding: 20px;
    background-color: #f5f5f5;
    border-radius: 8px;
  }
  
  .add-anime form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
    margin-bottom: 15px;
  }
  
  .add-anime input, .add-anime select, .add-anime button {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .add-anime button {
    background-color: #4CAF50;
    color: white;
    border: none;
    cursor: pointer;
  }
  
  .add-anime button:hover {
    background-color: #45a049;
  }
</style>

<div class="calendar-container">
  <div class="calendar-header">
    <h1>追番追剧日历</h1>
    <p>记录和管理你正在追的日剧、韩剧和动漫</p>
  </div>
  
  <div id="calendar-grid" class="calendar-grid">
    <!-- 日历将通过JavaScript生成 -->
  </div>
  
  <div class="add-anime">
    <h3>添加新剧集</h3>
    <form id="add-anime-form">
      <input type="text" id="anime-title" placeholder="剧集名称" required>
      <select id="anime-type" required>
        <option value="">选择类型</option>
        <option value="japanese">日剧/动漫</option>
        <option value="korean">韩剧</option>
        <option value="chinese">国产剧</option>
      </select>
      <input type="number" id="anime-day" min="1" max="7" placeholder="星期几 (1-7)" required>
      <input type="time" id="anime-time" required>
      <button type="submit">添加</button>
    </form>
  </div>
</div>

<script>
  // 存储剧集数据
  let animeList = JSON.parse(localStorage.getItem('animeList')) || [
    { title: '进击的巨人 最终季', type: 'japanese', day: 1, time: '21:00' },
    { title: '机智医生生活', type: 'korean', day: 2, time: '20:30' },
    { title: '半泽直树', type: 'japanese', day: 3, time: '21:00' },
    { title: '爱的迫降', type: 'korean', day: 4, time: '20:00' },
    { title: '鬼灭之刃', type: 'japanese', day: 5, time: '23:00' },
    { title: '请回答1988', type: 'korean', day: 6, time: '19:30' },
    { title: '斗罗大陆', type: 'chinese', day: 7, time: '18:00' }
  ];
  
  // 保存数据到本地存储
  function saveAnimeList() {
    localStorage.setItem('animeList', JSON.stringify(animeList));
  }
  
  // 生成日历
  function generateCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = '';
    
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    
    days.forEach((day, index) => {
      const dayElement = document.createElement('div');
      dayElement.className = `calendar-day ${index >= 5 ? 'weekend' : ''}`;
      
      dayElement.innerHTML = `
        <div class="day-header">${day}</div>
        <div class="day-number">${index + 1}</div>
        <div class="anime-list">
          ${animeList
            .filter(item => item.day === index + 1)
            .map(item => `
              <div class="anime-item ${item.type}">
                ${item.title} <br>
                <small>${item.time}</small>
              </div>
            `).join('')}
        </div>
      `;
      
      calendarGrid.appendChild(dayElement);
    });
  }
  
  // 处理添加剧集表单
  document.getElementById('add-anime-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const title = document.getElementById('anime-title').value;
    const type = document.getElementById('anime-type').value;
    const day = parseInt(document.getElementById('anime-day').value);
    const time = document.getElementById('anime-time').value;
    
    animeList.push({ title, type, day, time });
    saveAnimeList();
    generateCalendar();
    
    // 重置表单
    this.reset();
  });
  
  // 初始化日历
  generateCalendar();
</script>