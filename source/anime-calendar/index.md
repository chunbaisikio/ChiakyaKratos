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
      <table style="width: 100%; margin-bottom: 15px;">
        <tr>
          <td style="padding: 5px;"><input type="text" id="weekly-title" placeholder="剧集名称" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></td>
          <td style="padding: 5px;">
            <select id="weekly-type" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              <option value="">选择类型</option>
              <option value="japanese">日剧/动漫</option>
              <option value="korean">韩剧</option>
              <option value="chinese">国产剧</option>
            </select>
          </td>
          <td style="padding: 5px;">
            <select id="weekly-day" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              <option value="">选择星期</option>
              <option value="1">周一</option>
              <option value="2">周二</option>
              <option value="3">周三</option>
              <option value="4">周四</option>
              <option value="5">周五</option>
              <option value="6">周六</option>
              <option value="0">周日</option>
            </select>
          </td>
        </tr>
        <tr>
          <td style="padding: 5px;"><input type="time" id="weekly-time" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></td>
          <td style="padding: 5px;"><input type="date" id="weekly-start" placeholder="开始日期" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></td>
          <td style="padding: 5px;"><input type="date" id="weekly-end" placeholder="结束日期" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 5px; text-align: center;">
            <button id="add-weekly-btn" style="padding: 10px 30px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">添加剧集</button>
          </td>
        </tr>
      </table>
      <p style="font-size: 12px; color: #666; margin-top: 10px;">提示：开始和结束日期可选，不填则永久显示</p>
    </div>
    
    <div id="range-form" style="display: none;">
      <table style="width: 100%; margin-bottom: 15px;">
        <tr>
          <td style="padding: 5px;"><input type="text" id="range-title" placeholder="剧集名称" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></td>
          <td style="padding: 5px;">
            <select id="range-type" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              <option value="">选择类型</option>
              <option value="japanese">日剧/动漫</option>
              <option value="korean">韩剧</option>
              <option value="chinese">国产剧</option>
            </select>
          </td>
          <td style="padding: 5px;"><input type="time" id="range-time" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></td>
        </tr>
        <tr>
          <td style="padding: 5px;"><input type="date" id="range-start" placeholder="开始日期" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></td>
          <td style="padding: 5px;"><input type="date" id="range-end" placeholder="结束日期" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></td>
          <td style="padding: 5px; text-align: center;">
            <button id="add-range-btn" style="padding: 10px 30px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">添加剧集</button>
          </td>
        </tr>
      </table>
      <p style="font-size: 12px; color: #666; margin-top: 10px;">提示：将在指定日期范围内每天显示</p>
    </div>
  </div>
</div>

<script>
  var currentYear = new Date().getFullYear();
  var currentMonth = new Date().getMonth();
  var animeList = [];

  function initCalendar() {
    loadAnimeList();
    renderCalendar();
    renderCurrentMonth();
    
    document.getElementById('weekly-mode-btn').onclick = function() {
      switchMode('weekly');
    };
    
    document.getElementById('range-mode-btn').onclick = function() {
      switchMode('range');
    };
    
    document.getElementById('add-weekly-btn').onclick = addWeeklyAnime;
    
    document.getElementById('add-range-btn').onclick = addRangeAnime;
    
    document.getElementById('prev-month').onclick = function() {
      changeMonth(-1);
    };
    
    document.getElementById('next-month').onclick = function() {
      changeMonth(1);
    };
  }

  function loadAnimeList() {
    var stored = localStorage.getItem('animeList');
    if (stored) {
      animeList = JSON.parse(stored);
    }
  }

  function renderCurrentMonth() {
    var monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    document.getElementById('current-month').innerHTML = currentYear + '年' + monthNames[currentMonth];
  }

  function renderCalendar() {
    var container = document.getElementById('calendar-container');
    if (!container) return;

    var html = '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">';
    html += '<thead><tr>';
    var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    for (var i = 0; i < weekdays.length; i++) {
      html += '<th style="padding: 10px; background-color: #4CAF50; color: white; text-align: center; font-weight: bold; border: 1px solid #ddd;">' + weekdays[i] + '</th>';
    }
    html += '</tr></thead>';
    html += '<tbody>';

    var firstDay = new Date(currentYear, currentMonth, 1);
    var lastDay = new Date(currentYear, currentMonth + 1, 0);
    var startDayOfWeek = firstDay.getDay();
    var prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();

    var dayCount = 1;
    var nextMonthDay = 1;
    var today = new Date();

    for (var week = 0; week < 6; week++) {
      html += '<tr>';
      for (var dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        var cellIndex = week * 7 + dayOfWeek;
        if (cellIndex < startDayOfWeek) {
          var day = prevMonthLastDay - startDayOfWeek + cellIndex + 1;
          html += '<td style="padding: 10px; border: 1px solid #e0e0e0; background-color: #f0f0f0; opacity: 0.5; min-height: 80px; vertical-align: top;">';
          html += '<div style="font-size: 14px; color: #999; margin-bottom: 5px;">' + day + '</div>';
          html += '</td>';
        } else if (dayCount <= lastDay.getDate()) {
          var isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === dayCount;
          var isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          var bgColor = isWeekend ? '#f0f8ff' : '#f9f9f9';
          var borderStyle = isToday ? 'border: 2px solid #4CAF50;' : '';
          html += '<td style="padding: 10px; border: 1px solid #e0e0e0; background-color: ' + bgColor + '; ' + borderStyle + ' min-height: 80px; vertical-align: top;">';
          html += '<div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 5px;">' + dayCount + '</div>';

          var date = new Date(currentYear, currentMonth, dayCount);
          var dayAnimes = getAnimesForDate(date);
          for (var j = 0; j < dayAnimes.length; j++) {
            var anime = dayAnimes[j];
            var colorMap = { japanese: '#ff6b6b', korean: '#4ecdc4', chinese: '#45b7d1' };
            html += '<div style="background-color: #fff; border-radius: 4px; padding: 4px 6px; margin-bottom: 3px; font-size: 11px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 3px solid ' + colorMap[anime.type] + ';" onclick="showAnimeDetail(\'' + anime.id + '\')">';
            html += anime.title + '<br><small>' + anime.time + '</small>';
            html += '</div>';
          }
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
  }

  function getAnimesForDate(date) {
    var dateStr = formatDate(date);
    var dayOfWeek = date.getDay();
    var result = [];
    for (var i = 0; i < animeList.length; i++) {
      var anime = animeList[i];
      if (anime.mode === 'weekly') {
        if (anime.dayOfWeek !== dayOfWeek) continue;
        if (anime.startDate && dateStr < anime.startDate) continue;
        if (anime.endDate && dateStr > anime.endDate) continue;
        result.push(anime);
      } else if (anime.mode === 'range') {
        if (dateStr >= anime.startDate && dateStr <= anime.endDate) {
          result.push(anime);
        }
      }
    }
    return result;
  }

  function formatDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
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
    renderCalendar();
    renderCurrentMonth();
  }

  function switchMode(mode) {
    if (mode === 'weekly') {
      document.getElementById('weekly-form').style.display = 'block';
      document.getElementById('range-form').style.display = 'none';
      document.getElementById('weekly-mode-btn').style.backgroundColor = '#4CAF50';
      document.getElementById('weekly-mode-btn').style.color = 'white';
      document.getElementById('range-mode-btn').style.backgroundColor = '#f0f0f0';
      document.getElementById('range-mode-btn').style.color = '#333';
    } else {
      document.getElementById('weekly-form').style.display = 'none';
      document.getElementById('range-form').style.display = 'block';
      document.getElementById('range-mode-btn').style.backgroundColor = '#4CAF50';
      document.getElementById('range-mode-btn').style.color = 'white';
      document.getElementById('weekly-mode-btn').style.backgroundColor = '#f0f0f0';
      document.getElementById('weekly-mode-btn').style.color = '#333';
    }
  }

  function addWeeklyAnime() {
    var title = document.getElementById('weekly-title').value;
    var type = document.getElementById('weekly-type').value;
    var day = document.getElementById('weekly-day').value;
    var time = document.getElementById('weekly-time').value;
    var startDate = document.getElementById('weekly-start').value;
    var endDate = document.getElementById('weekly-end').value;

    if (!title || !type || !day || !time) {
      alert('请填写完整信息');
      return;
    }

    var anime = {
      id: Date.now().toString(),
      mode: 'weekly',
      title: title,
      type: type,
      dayOfWeek: parseInt(day),
      time: time,
      startDate: startDate || null,
      endDate: endDate || null
    };

    animeList.push(anime);
    localStorage.setItem('animeList', JSON.stringify(animeList));
    renderCalendar();

    document.getElementById('weekly-title').value = '';
    document.getElementById('weekly-type').value = '';
    document.getElementById('weekly-day').value = '';
    document.getElementById('weekly-time').value = '';
    document.getElementById('weekly-start').value = '';
    document.getElementById('weekly-end').value = '';
  }

  function addRangeAnime() {
    var title = document.getElementById('range-title').value;
    var type = document.getElementById('range-type').value;
    var startDate = document.getElementById('range-start').value;
    var endDate = document.getElementById('range-end').value;
    var time = document.getElementById('range-time').value;

    if (!title || !type || !startDate || !endDate || !time) {
      alert('请填写完整信息');
      return;
    }

    var anime = {
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
    renderCalendar();

    document.getElementById('range-title').value = '';
    document.getElementById('range-type').value = '';
    document.getElementById('range-start').value = '';
    document.getElementById('range-end').value = '';
    document.getElementById('range-time').value = '';
  }

  function showAnimeDetail(id) {
    var anime = null;
    for (var i = 0; i < animeList.length; i++) {
      if (animeList[i].id === id) {
        anime = animeList[i];
        break;
      }
    }
    if (!anime) return;

    var typeNames = { japanese: '日剧/动漫', korean: '韩剧', chinese: '国产剧' };
    var message = '剧集：' + anime.title + '\n';
    message += '类型：' + typeNames[anime.type] + '\n';
    message += '时间：' + anime.time + '\n';

    if (anime.mode === 'weekly') {
      var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      message += '每周：' + weekdays[anime.dayOfWeek] + '\n';
      if (anime.startDate) message += '开始：' + anime.startDate + '\n';
      if (anime.endDate) message += '结束：' + anime.endDate + '\n';
    } else {
      message += '日期范围：' + anime.startDate + ' 至 ' + anime.endDate + '\n';
    }
    alert(message);
  }

  window.onload = initCalendar;
</script>