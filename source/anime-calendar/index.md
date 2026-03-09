---
title: 追番追剧日历
date: 2026-03-09 00:00:00
layout: page
---

<style>
  .calendar-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }
  
  .calendar-header {
    text-align: center;
    margin-bottom: 30px;
  }
  
  .calendar-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .calendar-nav button {
    padding: 10px 20px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
  }
  
  .calendar-nav button:hover {
    background-color: #45a049;
  }
  
  .calendar-nav h2 {
    margin: 0;
    font-size: 24px;
  }
  
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 5px;
    margin-bottom: 30px;
  }
  
  .calendar-weekday {
    background-color: #4CAF50;
    color: white;
    padding: 10px;
    text-align: center;
    font-weight: bold;
    border-radius: 4px;
  }
  
  .calendar-day {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 10px;
    min-height: 100px;
    background-color: #f9f9f9;
    position: relative;
  }
  
  .calendar-day.other-month {
    background-color: #f0f0f0;
    opacity: 0.5;
  }
  
  .calendar-day.today {
    border: 2px solid #4CAF50;
  }
  
  .calendar-day.weekend {
    background-color: #f0f8ff;
  }
  
  .day-number {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 5px;
    color: #333;
  }
  
  .anime-item {
    background-color: #fff;
    border-radius: 4px;
    padding: 4px 6px;
    margin-bottom: 3px;
    font-size: 11px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    cursor: pointer;
    position: relative;
  }
  
  .anime-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
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
  
  .anime-item .delete-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    font-size: 10px;
    cursor: pointer;
    display: none;
    line-height: 1;
  }
  
  .anime-item:hover .delete-btn {
    display: block;
  }
  
  .add-anime {
    margin-top: 30px;
    padding: 20px;
    background-color: #f5f5f5;
    border-radius: 8px;
  }
  
  .add-anime h3 {
    margin-top: 0;
    margin-bottom: 15px;
  }
  
  .add-mode-tabs {
    display: flex;
    margin-bottom: 15px;
    border-bottom: 2px solid #e0e0e0;
  }
  
  .add-mode-tab {
    padding: 10px 20px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    color: #666;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
  }
  
  .add-mode-tab.active {
    color: #4CAF50;
    border-bottom-color: #4CAF50;
  }
  
  .add-mode-content {
    display: none;
  }
  
  .add-mode-content.active {
    display: block;
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
  
  .add-anime button[type="submit"] {
    background-color: #4CAF50;
    color: white;
    border: none;
    cursor: pointer;
    font-weight: bold;
  }
  
  .add-anime button[type="submit"]:hover {
    background-color: #45a049;
  }
  
  .legend {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 20px;
    padding: 10px;
    background-color: #f9f9f9;
    border-radius: 8px;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .legend-color {
    width: 20px;
    height: 20px;
    border-radius: 4px;
  }
  
  .legend-color.japanese {
    background-color: #ff6b6b;
  }
  
  .legend-color.korean {
    background-color: #4ecdc4;
  }
  
  .legend-color.chinese {
    background-color: #45b7d1;
  }
  
  .modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
  }
  
  .modal-content {
    background-color: white;
    margin: 10% auto;
    padding: 20px;
    border-radius: 8px;
    width: 80%;
    max-width: 500px;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  
  .modal-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #999;
  }
  
  .modal-close:hover {
    color: #333;
  }
</style>

<div class="calendar-container">
  <div class="calendar-header">
    <h1>追番追剧日历</h1>
    <p>记录和管理你正在追的日剧、韩剧和动漫</p>
  </div>
  
  <div class="calendar-nav">
    <button onclick="changeMonth(-1)">上个月</button>
    <h2 id="current-month"></h2>
    <button onclick="changeMonth(1)">下个月</button>
  </div>
  
  <div id="calendar-grid" class="calendar-grid">
    <!-- 日历将通过JavaScript生成 -->
  </div>
  
  <div class="legend">
    <div class="legend-item">
      <div class="legend-color japanese"></div>
      <span>日剧/动漫</span>
    </div>
    <div class="legend-item">
      <div class="legend-color korean"></div>
      <span>韩剧</span>
    </div>
    <div class="legend-item">
      <div class="legend-color chinese"></div>
      <span>国产剧</span>
    </div>
  </div>
  
  <div class="add-anime">
    <h3>添加新剧集</h3>
    
    <div class="add-mode-tabs">
      <button class="add-mode-tab active" onclick="switchMode('weekly')">每周固定时间</button>
      <button class="add-mode-tab" onclick="switchMode('range')">持续时间段</button>
    </div>
    
    <div id="weekly-mode" class="add-mode-content active">
      <form id="add-weekly-form">
        <input type="text" id="weekly-title" placeholder="剧集名称" required>
        <select id="weekly-type" required>
          <option value="">选择类型</option>
          <option value="japanese">日剧/动漫</option>
          <option value="korean">韩剧</option>
          <option value="chinese">国产剧</option>
        </select>
        <select id="weekly-day" required>
          <option value="">选择星期</option>
          <option value="1">周一</option>
          <option value="2">周二</option>
          <option value="3">周三</option>
          <option value="4">周四</option>
          <option value="5">周五</option>
          <option value="6">周六</option>
          <option value="0">周日</option>
        </select>
        <input type="time" id="weekly-time" required>
        <input type="date" id="weekly-start" placeholder="开始日期">
        <input type="date" id="weekly-end" placeholder="结束日期">
        <button type="submit">添加</button>
      </form>
      <p style="font-size: 12px; color: #666; margin-top: 10px;">
        提示：开始和结束日期可选，不填则永久显示
      </p>
    </div>
    
    <div id="range-mode" class="add-mode-content">
      <form id="add-range-form">
        <input type="text" id="range-title" placeholder="剧集名称" required>
        <select id="range-type" required>
          <option value="">选择类型</option>
          <option value="japanese">日剧/动漫</option>
          <option value="korean">韩剧</option>
          <option value="chinese">国产剧</option>
        </select>
        <input type="date" id="range-start" placeholder="开始日期" required>
        <input type="date" id="range-end" placeholder="结束日期" required>
        <input type="time" id="range-time" required>
        <button type="submit">添加</button>
      </form>
      <p style="font-size: 12px; color: #666; margin-top: 10px;">
        提示：将在指定日期范围内每天显示
      </p>
    </div>
  </div>
</div>

<div id="detail-modal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="modal-title"></h3>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <div id="modal-body"></div>
  </div>
</div>

<script>
  let currentDate = new Date();
  let currentYear = currentDate.getFullYear();
  let currentMonth = currentDate.getMonth();
  
  let animeList = JSON.parse(localStorage.getItem('animeList')) || [];
  
  function saveAnimeList() {
    localStorage.setItem('animeList', JSON.stringify(animeList));
  }
  
  function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    } else if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    generateCalendar();
  }
  
  function generateCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = '';
    
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    weekdays.forEach(day => {
      const weekdayElement = document.createElement('div');
      weekdayElement.className = 'calendar-weekday';
      weekdayElement.textContent = day;
      calendarGrid.appendChild(weekdayElement);
    });
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayElement = createDayElement(prevMonthLastDay - i, true, false);
      calendarGrid.appendChild(dayElement);
    }
    
    const today = new Date();
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const isToday = today.getFullYear() === currentYear && 
                      today.getMonth() === currentMonth && 
                      today.getDate() === day;
      const date = new Date(currentYear, currentMonth, day);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      const dayElement = createDayElement(day, false, isToday, isWeekend, date);
      calendarGrid.appendChild(dayElement);
    }
    
    const remainingDays = 42 - (startDayOfWeek + lastDay.getDate());
    for (let i = 1; i <= remainingDays; i++) {
      const dayElement = createDayElement(i, true, false);
      calendarGrid.appendChild(dayElement);
    }
    
    document.getElementById('current-month').textContent = 
      `${currentYear}年${currentMonth + 1}月`;
  }
  
  function createDayElement(day, isOtherMonth, isToday, isWeekend = false, date = null) {
    const dayElement = document.createElement('div');
    dayElement.className = `calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`;
    
    let animeItems = '';
    if (date && !isOtherMonth) {
      const dayAnimes = getAnimesForDate(date);
      animeItems = dayAnimes.map(anime => `
        <div class="anime-item ${anime.type}" onclick="showAnimeDetail('${anime.id}')">
          ${anime.title}
          <br><small>${anime.time}</small>
          <button class="delete-btn" onclick="deleteAnime('${anime.id}', event)">×</button>
        </div>
      `).join('');
    }
    
    dayElement.innerHTML = `
      <div class="day-number">${day}</div>
      <div class="anime-list">${animeItems}</div>
    `;
    
    return dayElement;
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
    return `${year}-${month}-${day}`;
  }
  
  function switchMode(mode) {
    document.querySelectorAll('.add-mode-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.add-mode-content').forEach(content => {
      content.classList.remove('active');
    });
    
    event.target.classList.add('active');
    document.getElementById(`${mode}-mode`).classList.add('active');
  }
  
  document.getElementById('add-weekly-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const anime = {
      id: Date.now().toString(),
      mode: 'weekly',
      title: document.getElementById('weekly-title').value,
      type: document.getElementById('weekly-type').value,
      dayOfWeek: parseInt(document.getElementById('weekly-day').value),
      time: document.getElementById('weekly-time').value,
      startDate: document.getElementById('weekly-start').value || null,
      endDate: document.getElementById('weekly-end').value || null
    };
    
    animeList.push(anime);
    saveAnimeList();
    generateCalendar();
    this.reset();
  });
  
  document.getElementById('add-range-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const anime = {
      id: Date.now().toString(),
      mode: 'range',
      title: document.getElementById('range-title').value,
      type: document.getElementById('range-type').value,
      startDate: document.getElementById('range-start').value,
      endDate: document.getElementById('range-end').value,
      time: document.getElementById('range-time').value
    };
    
    animeList.push(anime);
    saveAnimeList();
    generateCalendar();
    this.reset();
  });
  
  function deleteAnime(id, event) {
    event.stopPropagation();
    if (confirm('确定要删除这个剧集吗？')) {
      animeList = animeList.filter(anime => anime.id !== id);
      saveAnimeList();
      generateCalendar();
    }
  }
  
  function showAnimeDetail(id) {
    const anime = animeList.find(a => a.id === id);
    if (!anime) return;
    
    const modal = document.getElementById('detail-modal');
    document.getElementById('modal-title').textContent = anime.title;
    
    let details = `<p><strong>类型：</strong>${getTypeName(anime.type)}</p>`;
    details += `<p><strong>时间：</strong>${anime.time}</p>`;
    
    if (anime.mode === 'weekly') {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      details += `<p><strong>每周：</strong>${weekdays[anime.dayOfWeek]}</p>`;
      if (anime.startDate) details += `<p><strong>开始日期：</strong>${anime.startDate}</p>`;
      if (anime.endDate) details += `<p><strong>结束日期：</strong>${anime.endDate}</p>`;
    } else {
      details += `<p><strong>日期范围：</strong>${anime.startDate} 至 ${anime.endDate}</p>`;
    }
    
    document.getElementById('modal-body').innerHTML = details;
    modal.style.display = 'block';
  }
  
  function closeModal() {
    document.getElementById('detail-modal').style.display = 'none';
  }
  
  function getTypeName(type) {
    const types = {
      'japanese': '日剧/动漫',
      'korean': '韩剧',
      'chinese': '国产剧'
    };
    return types[type] || type;
  }
  
  window.onclick = function(event) {
    const modal = document.getElementById('detail-modal');
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  }
  
  generateCalendar();
</script>