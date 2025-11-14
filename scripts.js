// Global error tracing
window.addEventListener('error', function (evt) {
  try {
    console.error('Global error captured:', evt.message || evt.error || evt);
    // Optionally send to remote logging endpoint here
  } catch (e) {
    // swallow
  }
});

window.addEventListener('unhandledrejection', function (evt) {
  try {
    console.error('Unhandled promise rejection:', evt.reason);
    // Optionally send to remote logging endpoint here
  } catch (e) {}
});

document.addEventListener('DOMContentLoaded', function () {
  function toggleHikingSites(value) {
    var el = document.getElementById('hiking-sites');
    if (!el) return;
    try {
      if (value === 'hiking') {
        el.style.display = '';
      } else {
        el.style.display = 'none';
        // clear any selected hiking-site radios when hidden
        var radios = el.querySelectorAll('input[type="radio"]');
        radios.forEach(function (r) { r.checked = false; });
      }
    } catch (err) {
      // CSP may block inline style changes; fallback to toggling a class if possible
      try {
        if (value === 'hiking') el.classList.remove('hidden-by-csp'); else el.classList.add('hidden-by-csp');
      } catch (e) {}
    }
  }

  function updateDateRange() {
    var startEl = document.getElementById('start-date');
    var durEl = document.getElementById('duration');
    var endEl = document.getElementById('end-date');
    if (!startEl || !durEl || !endEl) return;

    var startVal = startEl.value;
    var durVal = parseInt(durEl.value, 10);
    if (!startVal || isNaN(durVal) || durVal < 1) {
      endEl.value = '';
      return;
    }

    var sd = new Date(startVal + 'T00:00:00');
    if (isNaN(sd.getTime())) {
      endEl.value = '';
      return;
    }

    // Duration is number of days; end date = start date + (duration - 1)
    var ed = new Date(sd);
    ed.setDate(sd.getDate() + Math.max(1, durVal) - 1);

    var yyyy = ed.getFullYear();
    var mm = String(ed.getMonth() + 1).padStart(2, '0');
    var dd = String(ed.getDate()).padStart(2, '0');
    endEl.value = yyyy + '-' + mm + '-' + dd;
  }

  // Wire up listeners for elements that previously used inline handlers
  var itinerarySelect = document.getElementById('itinerary-type');
  if (itinerarySelect) {
    itinerarySelect.addEventListener('change', function (e) {
      toggleHikingSites(e.target.value);
    });
  }

  var startEl = document.getElementById('start-date');
  var durEl = document.getElementById('duration');
  if (startEl) startEl.addEventListener('change', updateDateRange);
  if (durEl) durEl.addEventListener('change', updateDateRange);

  // Expose functions globally in case other scripts expect them
  window.toggleHikingSites = toggleHikingSites;
  window.updateDateRange = updateDateRange;
});
