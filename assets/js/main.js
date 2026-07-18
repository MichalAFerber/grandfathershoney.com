// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', function() {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function() {
      navLinks.classList.toggle('active');
      navToggle.classList.toggle('active');
    });

    // Close mobile menu when clicking a link
    navLinks.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        navLinks.classList.remove('active');
        navToggle.classList.remove('active');
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          const headerOffset = 80;
          const elementPosition = target.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }
    });
  });

  // Header background on scroll
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // Lazy loading for images
  if ('IntersectionObserver' in window) {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    const imageObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.classList.add('loaded');
          imageObserver.unobserve(img);
        }
      });
    });

    lazyImages.forEach(function(img) {
      imageObserver.observe(img);
    });
  }

  // Gallery lightbox with arrow navigation
  const galleryItems = document.querySelectorAll('.gallery-item');
  let currentLightboxIndex = 0;
  let lightboxImages = [];

  function openLightbox(index) {
    currentLightboxIndex = index;
    const img = lightboxImages[index].querySelector('img');
    if (img) {
      const lightbox = document.createElement('div');
      lightbox.className = 'lightbox';
      lightbox.innerHTML = '<div class="lightbox-content"><img src="' + img.src + '" alt=""><button class="lightbox-close">&times;</button><button class="lightbox-prev" aria-label="Previous image">&#10094;</button><button class="lightbox-next" aria-label="Next image">&#10095;</button></div>';
      document.body.appendChild(lightbox);

      const prevBtn = lightbox.querySelector('.lightbox-prev');
      const nextBtn = lightbox.querySelector('.lightbox-next');

      // Show/hide arrows based on position
      function updateArrows() {
        if (currentLightboxIndex === 0) {
          prevBtn.style.display = 'none';
        } else {
          prevBtn.style.display = 'block';
        }
        if (currentLightboxIndex === lightboxImages.length - 1) {
          nextBtn.style.display = 'none';
        } else {
          nextBtn.style.display = 'block';
        }
      }
      updateArrows();

      prevBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (currentLightboxIndex > 0) {
          lightbox.remove();
          openLightbox(currentLightboxIndex - 1);
        }
      });

      nextBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (currentLightboxIndex < lightboxImages.length - 1) {
          lightbox.remove();
          openLightbox(currentLightboxIndex + 1);
        }
      });

      lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
          lightbox.remove();
        }
      });

      document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
          lightbox.remove();
          document.removeEventListener('keydown', escHandler);
        } else if (e.key === 'ArrowLeft' && currentLightboxIndex > 0) {
          lightbox.remove();
          openLightbox(currentLightboxIndex - 1);
        } else if (e.key === 'ArrowRight' && currentLightboxIndex < lightboxImages.length - 1) {
          lightbox.remove();
          openLightbox(currentLightboxIndex + 1);
        }
      });
    }
  }

  galleryItems.forEach(function(item, index) {
    item.addEventListener('click', function() {
      lightboxImages = Array.from(galleryItems);
      openLightbox(index);
    });
  });

  // Contact form
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    const statusEl = document.getElementById('cf-status');
    const submitBtn = document.getElementById('cf-submit');

    function setStatus(message, type) {
      statusEl.textContent = message;
      statusEl.className = 'form-status' + (type ? ' is-' + type : '');
    }

    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      setStatus('', null);

      if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        return;
      }

      const tokenEl = contactForm.querySelector('[name="cf-turnstile-response"]');
      const token = tokenEl ? tokenEl.value : '';
      if (!token) {
        setStatus('Please complete the challenge and try again.', 'error');
        return;
      }

      submitBtn.disabled = true;
      setStatus('Sending…', null);

      fetch(contactForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactForm.name.value.trim(),
          email: contactForm.email.value.trim(),
          subject: contactForm.subject.value.trim(),
          message: contactForm.message.value.trim(),
          token: token
        })
      }).then(function(r) {
        return r.json().catch(function() { return { ok: r.ok }; });
      }).then(function(data) {
        if (data && data.ok) {
          contactForm.reset();
          setStatus('Thank you! Your message has been sent.', 'success');
        } else {
          setStatus((data && data.error) || 'Something went wrong. Please try again.', 'error');
        }
      }).catch(function() {
        setStatus('Could not reach the server. Please try again later.', 'error');
      }).finally(function() {
        submitBtn.disabled = false;
        if (window.turnstile) {
          window.turnstile.reset();
        }
      });
    });
  }
});
