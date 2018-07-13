const API_URL = 'http://192.168.104.228:8000/api/';

ons.ready(function() {

    var loginApp = new Vue({
        el: '#login',
        template: '#login-template',
        data: {
            fuelTankName: 'NOT REGISTERED',
            email: '',
            password: ''
        },
        methods: {
            admin: function() {
                try {
                    navigator.notification.alert('admin');
                } catch (e) {
                    alert(e)
                }
            },
            history: function() {
                alert('history');
            },
            login: function() {
                if (!this.email || !this.password) {
                    alert('Email dan password tidak boleh kosong');
                    return;
                }

                var data = {
                    email: this.email,
                    password: this.password
                };

                alert(this.email + this.password)

                // axios.post(API_URL + 'login', data).then(function(r) {
                //     if (r) {
                //         localStorage.userId = r.data.id;
                //         localStorage.name = r.data.name;
                //         localStorage.email = r.data.email;
                //         localStorage.isLoggedIn = 'true';
                //
                //         goTo('form-fuel', 'reset').then(function() {
                //
                //         });
                //     }
                //
                //     else {
                //         navigator.notification.alert('Username & password salah!');
                //     }
                // })
                //
                // .catch(function(error) {
                //     navigator.notification.alert('Gagal login! ' + JSON.stringify(error));
                // });
            }
        },
        mounted: function() {

        }
    });

    // misc. function
    var goTo = function(page, type) {
        var nav = document.querySelector('#my-navigator');
        if (type == 'replace') { return nav.replacePage(page, {animation: 'slide'}); }
        if (type == 'reset') { return nav.resetToPage(page, {animation: 'slide'}); }
        return nav.pushPage(page, {animation: 'slide'});
    };

});
