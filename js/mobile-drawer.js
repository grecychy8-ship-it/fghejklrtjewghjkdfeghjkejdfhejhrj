// Assignment Dai - Premium Mobile Navigation Drawer Controller
(function () {
    function initMobileDrawer() {
        const drawer = document.getElementById('awMobileDrawer');
        const openBtns = document.querySelectorAll('.aw-open-drawer-btn, .s2-open_mobile_menu');
        const closeBtn = document.getElementById('awDrawerCloseBtn');
        const backdrop = document.getElementById('awDrawerBackdrop');
        const navLinks = document.querySelectorAll('.aw-nav-link, .aw-drawer-actions a, .aw-support-btn-group a');

        if (!drawer) return;

        function openDrawer() {
            drawer.classList.add('is-active');
            document.body.classList.add('aw-drawer-open');
        }

        function closeDrawer() {
            drawer.classList.remove('is-active');
            document.body.classList.remove('aw-drawer-open');
        }

        openBtns.forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                openDrawer();
            });
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closeDrawer();
            });
        }

        if (backdrop) {
            backdrop.addEventListener('click', function (e) {
                e.preventDefault();
                closeDrawer();
            });
        }

        // Close on Escape key press
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && drawer.classList.contains('is-active')) {
                closeDrawer();
            }
        });

        // Auto close drawer when navigating
        navLinks.forEach(link => {
            link.addEventListener('click', function () {
                closeDrawer();
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileDrawer);
    } else {
        initMobileDrawer();
    }
})();
