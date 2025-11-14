// Toggle menu functionality
function toggleMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const menuIcon = document.querySelector('.menu-icon');
    navMenu.classList.toggle('active');
    menuIcon.classList.toggle('active');
}

// Date range calculation
function updateDateRange() {
    const startDate = document.getElementById('start-date');
    const endDate = document.getElementById('end-date');
    const duration = document.getElementById('duration');

    if (startDate.value && duration.value) {
        const start = new Date(startDate.value);
        const end = new Date(start);
        end.setDate(start.getDate() + parseInt(duration.value) - 1);

        // Format the date as YYYY-MM-DD for the input
        const formattedEndDate = end.toISOString().split('T')[0];
        endDate.value = formattedEndDate;
    }
}

// Toggle hiking sites visibility
function toggleHikingSites(value) {
    const hikingSites = document.getElementById('hiking-sites');
    hikingSites.style.display = value === 'hiking' ? 'block' : 'none';
}

// Modal functionality
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('quote-modal')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};
//buttons
//navbar toggle
document.addEventListener("DOMContentLoaded", () => {
  const menuIcon = document.querySelector('.menu-icon');
  menuIcon.addEventListener('click', toggleMenu);
});
//scroll buttons for booking events
document.addEventListener("DOMContentLoaded", () => {
  const scrollButtons = document.querySelectorAll('.scroll-btn');

  scrollButtons.forEach(button => {
    button.addEventListener('click', () => {
      const direction = button.classList.contains('scroll-left') ? -1 : 1;
      scrollEvents(button, direction);
    });
  });
});
//scroll buttons for custom quotes
document.addEventListener("DOMContentLoaded", () => {
  const customScrollButtons = document.querySelectorAll('.custom-quote-container .scroll-btn');

  customScrollButtons.forEach(button => {
    button.addEventListener('click', () => {
      const direction = button.classList.contains('scroll-left') ? -1 : 1;
      scrollCustomCards(button, direction);
    });
  });
});
//request quote button
document.addEventListener("DOMContentLoaded", () => {
  const quoteButtons = document.querySelectorAll('.quote-btn');

  quoteButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modalId = button.dataset.target;
      if (!modalId) return;
      openModal(modalId);
    });
  });
});
//modal templates
document.addEventListener("DOMContentLoaded", () => {
  const closeButtons = document.querySelectorAll('.close-modal');

  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modalId = button.dataset.target;
      if (!modalId) return;
      closeModal(modalId);
    });
  });
});
//submit quote request forms
document.addEventListener("DOMContentLoaded", () => {
  const quoteForms = document.querySelectorAll('.quote-form');

  quoteForms.forEach(form => {
    form.addEventListener('submit', (event) => {
      event.preventDefault(); // prevent default form submission
      const formType = form.dataset.type || 'General';
      const formData = new FormData(form);
      submitQuoteRequest(formData, formType);
    });
  });
});

// Safely attach handlers that reference elements that may load later
document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("closeModalBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      const modal = document.getElementById("bookingModal");
      if (modal) modal.classList.remove("active");
    });
  }

  const modalBookingForm = document.getElementById("modalBookingForm");
  if (modalBookingForm) {
    modalBookingForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      console.log("Booking submitted:", Object.fromEntries(data));
      // you can now call your payment API or EmailJS send() function here
    });
  }
});
