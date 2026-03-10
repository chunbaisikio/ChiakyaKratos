(function() {
  function getAnimesForDate(date, list) {
    var dateStr = formatDate(date);
    var dayOfWeek = date.getDay();
    var result = [];
    for (var i = 0; i < list.length; i++) {
      var anime = list[i];
      if (anime.mode === 'weekly') {
        var weeklyDays = Array.isArray(anime.dayOfWeek) ? anime.dayOfWeek : [anime.dayOfWeek];
        if (weeklyDays.indexOf(dayOfWeek) === -1) continue;
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

  function renderWidget(container, list) {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    var startDayOfWeek = firstDay.getDay();
    var prevMonthLastDay = new Date(year, month, 0).getDate();

    var monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    var html = '';
    html += '<div class="acw-header">' + year + '年' + monthNames[month] + '</div>';
    html += '<table><thead><tr>';
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    for (var i = 0; i < weekdays.length; i++) {
      html += '<th>' + weekdays[i] + '</th>';
    }
    html += '</tr></thead><tbody>';

    var dayCount = 1;
    var nextMonthDay = 1;
    for (var week = 0; week < 6; week++) {
      html += '<tr>';
      for (var dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        var cellIndex = week * 7 + dayOfWeek;
        if (cellIndex < startDayOfWeek) {
          var day = prevMonthLastDay - startDayOfWeek + cellIndex + 1;
          html += '<td class="acw-weekend" style="opacity:0.5"><span class="acw-day">' + day + '</span></td>';
        } else if (dayCount <= lastDay.getDate()) {
          var isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === dayCount;
          var isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          var cellClass = '';
          if (isWeekend) cellClass += ' acw-weekend';
          if (isToday) cellClass += ' acw-today';
          var date = new Date(year, month, dayCount);
          html += '<td class="' + cellClass.trim() + '" data-acw-date="' + formatDate(date) + '">';
          html += '<span class="acw-day">' + dayCount + '</span>';
          var dayAnimes = getAnimesForDate(date, list);
          if (dayAnimes.length) {
            var colorMap = { japanese: '#ff6b6b', korean: '#4ecdc4', chinese: '#4CAF50' };
            html += '<div class="acw-dots">';
            var shown = {};
            for (var j = 0; j < dayAnimes.length; j++) {
              var type = dayAnimes[j].type;
              if (shown[type]) continue;
              shown[type] = true;
              html += '<span class="acw-dot" style="background-color:' + colorMap[type] + '"></span>';
            }
            html += '</div>';
          }

          html += '</td>';
          dayCount++;
        } else {
          html += '<td class="acw-weekend" style="opacity:0.5"><span class="acw-day">' + nextMonthDay + '</span></td>';
          nextMonthDay++;
        }
      }
      html += '</tr>';
      if (dayCount > lastDay.getDate()) break;
    }
    html += '</tbody></table>';

    container.innerHTML = html;
  }

  function loadAndRender() {
    var containers = document.querySelectorAll('[data-anime-calendar-widget]');
    if (!containers.length) return;

    for (var i = 0; i < containers.length; i++) {
      renderWidget(containers[i], []);
    }

    fetch('/anime-calendar/data.json')
      .then(function(response) {
        if (!response.ok) throw new Error('load failed');
        return response.json();
      })
      .then(function(data) {
        var list = Array.isArray(data) ? data : [];
        for (var i = 0; i < containers.length; i++) {
          renderWidget(containers[i], list);
        }
        bindWidgetClick(list);
      })
      .catch(function(error) {
        console.error(error);
        for (var i = 0; i < containers.length; i++) {
          renderWidget(containers[i], []);
        }
      });
  }

  function bindWidgetClick(list) {
    var containers = document.querySelectorAll('[data-anime-calendar-widget]');
    for (var i = 0; i < containers.length; i++) {
      containers[i].onclick = function(event) {
        var target = event.target;
        if (!target) return;
        var cell = target.closest('td[data-acw-date]');
        if (!cell) return;
        var dateStr = cell.getAttribute('data-acw-date');
        if (!dateStr) return;
        var date = new Date(dateStr + 'T00:00:00');
        var dayAnimes = getAnimesForDate(date, list);
        if (!dayAnimes.length) return;
        showAnimeDetailForDate(dayAnimes, dateStr);
      };
    }
    bindOverlayClose();
  }

  function bindOverlayClose() {
    var overlay = document.querySelector('[data-acw-overlay]');
    var card = document.querySelector('[data-acw-overlay-card]');
    if (!overlay || !card) return;
    overlay.onclick = function(event) {
      if (event.target === overlay) {
        closeOverlay();
      }
    };
  }

  function showAnimeDetailForDate(dayAnimes, dateStr) {
    var typeNames = { japanese: '日剧/动漫', korean: '韩剧', chinese: '国产剧' };
    var message = '日期：' + dateStr + '\n\n';
    for (var i = 0; i < dayAnimes.length; i++) {
      var anime = dayAnimes[i];
      message += '剧集：' + anime.title + '\n';
      message += '类型：' + typeNames[anime.type] + '\n';
      if (anime.description) {
        message += '简介：' + anime.description + '\n';
      }
      if (anime.mode === 'weekly') {
        var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        var weeklyDays = Array.isArray(anime.dayOfWeek) ? anime.dayOfWeek : [anime.dayOfWeek];
        var names = weeklyDays.map(function(dayIndex) { return weekdays[dayIndex]; });
        message += '每周：' + names.join('、') + '\n';
        if (anime.startDate) message += '开始：' + anime.startDate + '\n';
        if (anime.endDate) message += '结束：' + anime.endDate + '\n';
      } else {
        message += '日期范围：' + anime.startDate + ' 至 ' + anime.endDate + '\n';
      }
      if (i < dayAnimes.length - 1) message += '\n';
    }
    openOverlay(message);
  }

  function openOverlay(message) {
    var overlay = document.querySelector('[data-acw-overlay]');
    var card = document.querySelector('[data-acw-overlay-card]');
    if (!overlay || !card) return;
    card.textContent = message;
    overlay.classList.add('is-open');
  }

  function closeOverlay() {
    var overlay = document.querySelector('[data-acw-overlay]');
    if (!overlay) return;
    overlay.classList.remove('is-open');
  }

  window.AnimeCalendarWidgetInit = loadAndRender;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndRender);
  } else {
    loadAndRender();
  }
  window.addEventListener('pjax:complete', loadAndRender);
})();
