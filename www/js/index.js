var app = {
    counter             : 0,
    db                  : null,
    user                : null,
    server_is_busy      : false,
    sync_status         : true,
    data				: {},
    wifi_connection     : false,
    server_connection   : false,
    server_url          : 'http://10.13.27.60/api/',
    // server_url       : 'http://192.168.0.15:8000/api/',

    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    onDeviceReady: function() {
        var _this = this;
		AndroidFullScreen.immersiveMode();
		window.plugins.insomnia.keepAwake();

		if (localStorage.server_url == null) {
			localStorage.server_url = _this.server_url;
		}

		if (localStorage.fuel_tank_name == null) {
			localStorage.fuel_tank_name = 'BELUM TERDAFTAR';
		}

		$('#fuel-tank-info').html(localStorage.fuel_tank_name);

		_this.get_db_connection();

		if (localStorage.dbPopulated == null) {
			_this.init_db();
		}

        // redirect to main if already logged in
        if (localStorage.is_logged_in == 'true') {
            _this.goTo('form-fuel.html').then(function() {
                $('#fuel-tank').html(localStorage.fuel_tank_name);
                $('#user').html(localStorage.name);
            });
        }

        var counter = 0;

        setInterval(function() {
            // counter tetep taruh di atas
            counter += 1;

            // uncomment in prod
            if (navigator.connection.type != Connection.WIFI) {
                _this.wifi_connection = false;
                _this.server_connection = false;
                return;
            }

            _this.wifi_connection = true;

            if (_this.server_is_busy == true) {
                return;
            }

            if (_this.server_connection == true) {
                if (localStorage.is_registered == 'true') {
                    _this.upload();

                    if (counter % 300 == 0) {
                        _this.sinkronisasi();
                    }
                }
            }

            else {
                $.ajax({
                    url: localStorage.server_url + 'ping',
                    timeout: 3000,
                    type: 'get', dataType: 'json', crossDomain: true,
                    success: function(r) {
                        _this.server_connection = true;

                        if (localStorage.is_registered == 'true') {
                            _this.upload();

                            if (counter % 300 == 0) {
                                _this.sinkronisasi();
                            }
                        }
                    },
                    error: function(e) {
                        _this.server_connection = false;
                    }
                });
            }

        }, 1000);

    },

    history: function() {
        var _this = this;
        _this.goTo('history.html').then(function() {

            _this.db.executeSql("DELETE FROM `fuel_refills` WHERE `uploaded` = 1 AND `date` < DATE('now', 'localtime')", [],
                function(r) {/*alert(JSON.stringify(r))*/},
                function(e) {/*alert(JSON.stringify(e))*/}
            );

            _this.db.executeSql('SELECT id FROM `fuel_refills` WHERE `uploaded` = 0', [], function(r) {
                localStorage.localData = r.rows.length;
            });

            _this.db.executeSql('SELECT `fuel_refills`.*, `employees`.`name` AS `operator`, `units`.`name` AS `unit` FROM `fuel_refills` JOIN `employees` ON `employees`.`id` = `fuel_refills`.`employee_id` JOIN `units` ON `units`.`id` = `fuel_refills`.`unit_id` ORDER BY `fuel_refills`.`id` DESC', [], function(r) {

                var tableRow = '<ons-list-item>Pending Upload : ' + localStorage.localData + '</ons-list-item>';

    			for (var i = 0; i < r.rows.length; i++) {
    				row = r.rows.item(i)

                    var icon = row.uploaded
                        ? '<ons-icon icon="ion-checkmark"></ons-icon>'
                        : '<ons-icon icon="ion-close"></ons-icon>';

                    tableRow += '<ons-list-item>' +
                        '<small>'+ row.date +' &bull; ' + row.start_time + ' &bull; Shift ' + row.shift + '</small><br>' +
                        '<span class="list-item__title">' +
                            icon + ' ' + row.unit + ' / ' + row.operator + ' / ' + row.total_real + 'L' +
                        '</span>' +
                    '</ons-list-item>';
    			}

                $('#history-list').html(tableRow);
    		},
    		function(e) {
    			navigator.notification.alert(e.message);
    		});
        });
    },

    input: function() {
        var t = this;
		var total_real = $('#total_real').val();
		var total_recommended = $('#total_recommended').val();
		var hm_last = $('#hm_last').val();
		var km_last = $('#km_last').val();
		var unit = $('#unit').val();
		var hm = $('#hm').val();
		var km = $('#km').val();

		if (total_real == '') {
			alert('Total real tidak boleh kosong');
			return;
		}

		if (unit == '') {
			alert('Unit tidak boleh kosong');
			return;
		}

		if (hm === '') {
			alert('HM tidak boleh kosong');
			return;
		}

		if (km === '') {
			alert('KM tidak boleh kosong');
			return;
		}

        if (hm < hm_last) {
            alert('HM kurang dari HM Last');
			return;
        }

        if (km < km_last) {
            alert('KM kurang dari KM Last');
			return;
        }

		// sukses validasi
		t.goTo('otorisasi.html', 'reset').then(function() {
			// ini buat disimpan kemudian
            t.data.total_recommended= total_recommended,
			t.data.total_real       = total_real,
			t.data.hm_last			= hm_last,
			t.data.km_last			= km_last
			t.data.hm				= hm,
			t.data.km				= km,

			$('#km').html(km);
			$('#hm').html(hm);
			$('#hm_last').html(hm_last);
			$('#km_last').html(km_last);
			$('#total_real').html(total_real);
			$('#unit').html(unit.toUpperCase());
			$('#total_recommended').html(total_recommended);

			// alert(JSON.stringify(t.data));

		});

    },

	otorisasi: function() {
		var t = this;
		var nrp = $('#nrp').val();

		if (nrp == '') {
			navigator.notification.alert('NRP tidak boleh kosong');
			return;
		}

		t.db.transaction(function(tx) {
			// validasi nrp
			var sql = 'SELECT * FROM `employees` WHERE `nrp` LIKE ? LIMIT 1';
			tx.executeSql(sql, [nrp], function(tx,r) {
				if (r.rows.length == 0) {
					navigator.notification.alert('Karyawan tidak terdaftar');
					return;
				}

				var employee = r.rows.item(0);

				ons.notification.alert({
					message: 'Anda yakin akan melakukan otorisasi, '+employee.name+'?',
					title: 'OTORISASI',
					buttonLabels: ['TIDAK', 'YA'],
					callback: function(btn) {
						if (btn == 1) {
							var now = new Date();
                            var shift = t.getShift();
                            if (shift == 2) {
                                now.setDate(date.getDate() - 1);
                            }

                            var date = t.dateToYmdHis(now, 'Ymd');

                            var data = [
                                date,
                                shift,
								localStorage.fuel_tank_id,
								t.data.unit_id,
								employee.id,
								t.data.start_time,
								t.dateToYmdHis(now, 'His'),
								t.data.hm,
                                t.data.km,
                                t.data.hm_last,
                                t.data.km_last,
								t.data.total_real,
								t.data.total_recommended,
                                localStorage.user_id
							];

							t.save(data);
						}
					}
				});

			}, function(tx,e) {
				navigator.notification.alert('Failed to check operator '+e.message);
			});
		});

	},

	save: function(data) {
		var t = this;
		t.db.transaction(function(tx) {
			var sql = "INSERT INTO `fuel_refills` (date, shift, fuel_tank_id, unit_id, employee_id, start_time, finish_time, hm, km, hm_last, km_last, total_real, total_recommended, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

			tx.executeSql(sql, data, function(tx,rr) {
				// reset page
				t.goTo('form-fuel.html', 'reset').then(function() {
					navigator.notification.alert('Otorisasi BERHASIL! Data berhasil disimpan.');
					t.data = {};
					$('#fuel-tank').html(localStorage.fuel_tank_name);
                    $('#user').html(localStorage.name);
				});


			}, function(tx,e) {
				navigator.notification.alert('Gagal menyimpan data.' + e.message);
			});
		});
	},

	getLastHmKm: function(unit) {
		var t = this;
		t.db.transaction(function(tx) {
			tx.executeSql('SELECT * FROM units WHERE name LIKE ? LIMIT 1', [unit], function(tx,r) {
				if (r.rows.length > 0) {
					var u = r.rows.item(0);
					var now = new Date();
					t.data.unit_id = u.id;
                    t.data.fc = u.fc;
					t.data.start_time = t.dateToYmdHis(now, 'His');

					var sql = 'SELECT * FROM `last_trx` WHERE `unit_id` = ? ORDER BY `id` ASC LIMIT 1';
					tx.executeSql(sql, [u.id], function(tx,rr) {
						var trx = (rr.rows.length > 0) ? rr.rows.item(0) : false;

						if (trx != null) {
							$('#hm_last').val(trx.hm);
							$('#km_last').val(trx.km);
						}

					});
				}

				else {
					navigator.notification.alert('Unit tidak terdaftar');
				}

			}, function(tx,e) {
				navigator.notification.alert('Unit tidak terdaftar');
			});

		});
	},

	hitungTotalRecommended: function(hm) {
		var totalRecomended = (hm - $('#hm_last').val()) * this.data.fc;
		$('#total_recommended').val(totalRecomended);
	},

	getShift: function() {
		// 06.01 => 18.00 S1
		// 18.01 => 06.00 S2

		var now = new Date();
		var jam = now.getHours();

		return (jam >= 6 && jam <= 18) ? 1 : 2;
	},

	// upload data transaksi
    upload: function() {
        var _this = this;
		_this.db.executeSql('SELECT * FROM `fuel_refills` WHERE `uploaded` = 0 ORDER BY `id` ASC LIMIT 50', [], function(r) {

			if (r.rows.length == 0) {return;}

			var dataToSend = [];
			var idToDelete = '';

			for (var i = 0; i < r.rows.length; i++) {
				row = r.rows.item(i)
				dataToSend.push(row);
				idToDelete += row.id+',';
			}

			idToDelete += '0'; // biar ga error
			var rows = JSON.stringify(dataToSend);

            // jangan dikasih timeout
			$.ajax({
				url: localStorage.server_url + 'fuelRefill',
				data: {rows:rows},
				crossDomain: true, type: 'post', dataType: 'json',
                beforeSend: function() {
                    _this.server_is_busy = true;
                },
				success: function(res) {
					_this.db.transaction(function(tx) {
						tx.executeSql('UPDATE `fuel_refills` SET `uploaded` = 1 WHERE id IN ('+idToDelete+')', [],
							function(tx,result) {
								tx.executeSql('SELECT id FROM `fuel_refills` WHERE `uploaded` = 0', [], function(tx,r) {
									localStorage.localData = r.rows.length;
								});
							},
							function(tx,error) {
							}
						);
					});
                    _this.server_is_busy = false;
				},
				error: function(e) {
                    _this.server_is_busy = false;
				}
			});
		},
		function(e) {
			// buat debug doank
			navigator.notification.alert(e.message);
		});
    },

    goTo: function(page, type) {
        var nav = document.querySelector('#my-navigator');
        if (type == 'replace') { return nav.replacePage(page, {animation: 'slide'}); }
        if (type == 'reset') { return nav.resetToPage(page, {animation: 'slide'}); }
        return nav.pushPage(page, {animation: 'slide'});
    },

	batal: function() {
		var _this = this;
		_this.goTo('form-fuel.html', 'reset').then(function() {
			$('#fuel-tank').html(localStorage.fuel_tank_name);
            $('#user').html(localStorage.name);
		});
	},

    login: function() {
        var t = this;
        var email = $('#email').val();
        var password = $('#password').val();

        if (email == '' || password == '') {
            navigator.notification.alert('Email dan password tidak boleh kosong');
            return;
        }

        window.plugins.spinnerDialog.show(null, 'Logging in...');

        $.ajax({
            url: localStorage.server_url + 'login',
            timeout: 3000,
            crossDomain: true, type: 'post', dataType: 'json',
            data: {email:email, password:password},
            success: function(res) {
                window.plugins.spinnerDialog.hide();
                t.user = res;

                t.goTo('form-fuel.html', 'reset').then(function() {
                    localStorage.name 		= t.user.name;
                    localStorage.email 	    = t.user.email;
                    localStorage.user_id 	= t.user.id;
                    localStorage.is_logged_in = 'true';

                    $('#fuel-tank').html(localStorage.fuel_tank_name);
                    $('#user').html(localStorage.name);
                });

            },
            error: function(e) {
                window.plugins.spinnerDialog.hide();
                navigator.notification.alert('Gagal login. Cek koneksi Wifi atau username/password salah.');
            }
        });
    },

    check_user_offline: function(email) {
        this.db.executeSql("SELECT * FROM `users` WHERE `email` LIKE ? ", [email], function(r) {
            return r.rows.length == 0 ? false : r.rows.item(0);
        }, function(e) {
            return false;
        });

        return false;
    },

    update_user: function(name, email, password, id) {
        this.db.transaction(function(tx) {
            var sql = "";
            var sql_insert = "INSERT INTO `users` (name, email, password, id) VALUES (?,?,?,?)";
            var sql_update = "UPDATE `users` SET name = ?, email = ?, password = ? WHERE id = ?";

            tx.executeSql("SELECT * FROM `users` WHERE email LIKE ?", [email], function(tx, r) {
                sql = r.rows.length == 0 ? sql_insert : sql_update;

                tx.executeSql(sql, [name, email, password, id], function(tx, rr) {
                    alert(JSON.stringify(rr))
                }, function(tx, e) {
                    alert(JSON.stringify(e))
                });

            });
        });
    },

    login_belum_jadi: function() {
        var _this = this;
        var email = $('#email').val();
        var password = $('#password').val();

        if (email == '' || password == '') {
            navigator.notification.alert('Email dan password tidak boleh kosong');
            return;
        }

        if (_this.server_connection == true) {
            $.ajax({
                url: localStorage.server_url + 'login',
                timeout: 3000,
                crossDomain: true, type: 'post', dataType: 'json',
                data: {email:email, password:password},
                beforeSend: function() {
                    window.plugins.spinnerDialog.show(null, 'Checking user on the server...');
                },
                success: function(res) {
                    _this.user = res;
                    window.plugins.spinnerDialog.hide();
                    _this.update_user(res.name, email, password, res.id);
                    _this.go_to_main();
                },
                error: function(e) {
                    window.plugins.spinnerDialog.hide();
                    navigator.notification.alert('Username/password salah.');
                }
            });
        }

        else {
            var user = _this.check_user_offline(email);

            if (user && user.password == password) {
                _this.user = user;
                _this.go_to_main();
            }

            else {
                navigator.notification.alert('Username/password salah.');
            }
        }
    },

    go_to_main: function() {
        var _this = this;
        _this.goTo('form-fuel.html', 'reset').then(function() {
            localStorage.name = _this.user.name;
            localStorage.email = _this.user.email;
            localStorage.user_id = _this.user.id;
            localStorage.is_logged_in = 'true';
            $('#fuel-tank').html(localStorage.fuel_tank_name);
            $('#user').html(localStorage.name);
        });
    },

    scanNrp: function() {
        cordova.plugins.barcodeScanner.scan(
            function (result) {
                $("#nrp").val(result.text);
            },
            function (error) {
                alert("Scanning failed: " + error);
            },
            {
                preferFrontCamera : false, // iOS and Android
                showFlipCameraButton : true, // iOS and Android
                showTorchButton : true, // iOS and Android
                torchOn: false, // Android, launch with the torch switched on (if available)
                saveHistory: true, // Android, save scan history (default false)
                prompt : "Place a barcode inside the scan area", // Android
                resultDisplayDuration: 500, // Android, display scanned text for X ms. 0 suppresses it entirely, default 1500
                formats : "QR_CODE,PDF_417", // default: all but PDF_417 and RSS_EXPANDED
                orientation : "portrait", // Android only (portrait|landscape), default unset so it rotates with the device
                disableSuccessBeep: false // iOS and Android
            }
        );
    },

    logout: function() {
		var _this = this;
        ons.notification.confirm('Anda yakin akan logout?', {
            title: 'LOGOUT',
            buttonLabels: ['TIDAK', 'LOGOUT'],
            callback: function(btn) {
                if (btn == 1) {
                    _this.goTo('login.html', 'reset').then(function() {
						_this.user = null;
						localStorage.name = null;
						localStorage.email = null;
						localStorage.is_logged_in = 'false';
						localStorage.user_id = null;
						$('#fuel-tank-info').html(localStorage.fuel_tank_name);
                    });
                }
            }
        });
    },

	admin: function() {
        var _this = this;
        var pass = $('#admin-pass').val();

        if (pass != 'Kpp12345persada') {
            navigator.notification.alert('Password admin salah');
            return;
        }

		localStorage.adminIsLoggedIn = 'true';
		_this.goTo('admin.html', 'replace');
    },

	logoutAdmin: function() {
        var _this = this;
        ons.notification.confirm('Anda yakin akan logout dari halaman admin?', {
            title: 'LOGOUT',
            buttonLabels: ['TIDAK', 'LOGOUT'],
            callback: function(btn) {
                if (btn == 1) {
                    _this.goTo('login.html', 'reset').then(function() {
                        localStorage.adminIsLoggedIn = 'false';
						$('#fuel-tank-info').html(localStorage.fuel_tank_name);
                    });
                }
            }
        });
    },

	set_server_url: function() {
        // uncomment in prod
        if (navigator.connection.type != Connection.WIFI) {
            navigator.notification.alert('Check koneksi WIFI!');
            return;
        }

        var _this = this;
        var server_url = $('#server-url').val();

        if (server_url == '') {
            navigator.notification.alert('Server URL tidak boleh kosong');
        } else {
            _this.goTo('admin.html', 'replace').then(function() {
	            _this.server_url = localStorage.server_url = server_url;
                $.ajax({
                    url: localStorage.server_url + 'ping',
                    timeout: 3000,
                    type: 'get', dataType: 'json', crossDomain: true,
                    beforeSend: function() {
                        window.plugins.spinnerDialog.show(null, 'Checking server connection...')
                    },
                    success: function(r) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Connection to server SUCCESS. ' + server_url);
                    },
                    error: function(e) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Connection to server FAILED. ' + JSON.stringify(e));
                    }
                });
			});
        }
    },

	sinkronisasi: function() {
        if (this.server_connection == true) {
            this.getEmployee();
            this.getFuelTank();
            this.getUnit();
            this.getLastTransaction();
        }

        else {
            navigator.notification.alert('Sinkronisasi GAGAL.Tidak terhubung ke server!');
        }
    },

    exit: function() {
        ons.notification.confirm('Anda yakin akan keluar dari aplikasi?', {
            title: 'KELUAR',
            buttonLabels: ['TIDAK', 'KELUAR'],
            callback: function(btn) {
                if (btn == 1) {
                    KioskPlugin.exitKiosk();
                    navigator.app.exitApp();
                }
            }
        });
    },

    dateToYmdHis: function(date, format) {
        var Y = date.getFullYear();
        var m = this.zeroPad(date.getMonth() + 1);
        var d = this.zeroPad(date.getDate());
        var H = this.zeroPad(date.getHours());
        var i = this.zeroPad(date.getMinutes());
        var s = this.zeroPad(date.getSeconds());

        Ymd = Y + '-' + m + '-' + d;
        His = H + ':' + i + ':' + s;
        var YmdHis = Ymd + ' ' + His;

        if (format == 'Ymd') { return Ymd; }
        if (format == 'His') { return His; }
        if (format == 'YmdHis') { return Ymdhis; }
    },

    zeroPad: function(n) {
        return (n < 10) ? '0' + n : n;
    },

    getEmployee: function() {
        var t = this;

        $.ajax({
            url: localStorage.server_url + 'employee',
            timeout: 3000,
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching employee list...');
            },
            error: function(e) {
                t.sync_status = false;
            },
            success: function(rows) {
                var sql = []
        		sql.push("DROP TABLE IF EXISTS `employees`");
        		sql.push("CREATE TABLE `employees` ("+
                    "`id` integer PRIMARY KEY AUTOINCREMENT,"+
                    "`nrp` varchar(100) NOT NULL,"+
                    "`name` varchar(100) NOT NULL"+
                ")");

        		t.db.sqlBatch(sql, function() {
        			window.plugins.spinnerDialog.hide();
                }, function(e) {
        			window.plugins.spinnerDialog.hide();
                    navigator.notification.alert('Error create table : '+ e.message);
                });

                t.db.transaction(function(tx) {
                        rows.forEach(function(row) {
                            var sql = "INSERT INTO `employees` (id,nrp,name) VALUES (?,?,?)";
                            var data = [row.id, row.nrp, row.name];
                            tx.executeSql(sql, data);
                        });
                    },
                    function(e) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Failed to fetch employee list. '+e.message);
                    },
                    function() {
                        window.plugins.spinnerDialog.hide();
                        // navigator.notification.alert('Employee list fetched OK : '+JSON.stringify(rows));
                    }
                );
            }
        });
    },

    getUnit: function() {
        var t 	= this;

        $.ajax({
            url: localStorage.server_url + 'unit',
            timeout: 3000,
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching unit list...');
            },
            error: function(e) {
                t.sync_status = false;
            },
            success: function(rows) {
                var sql = []
        		sql.push("DROP TABLE IF EXISTS `units`");
        		sql.push("CREATE TABLE IF NOT EXISTS `units` ("+
                    "`id` integer PRIMARY KEY AUTOINCREMENT,"+
                    "`name` varchar(100) NOT NULL,"+
                    "`fc` integer(3) NULL"+
                ")");

        		t.db.sqlBatch(sql, function() {
        			window.plugins.spinnerDialog.hide();
                }, function(e) {
        			window.plugins.spinnerDialog.hide();
                    navigator.notification.alert('Error create table : '+ e.message);
                });

                t.db.transaction(function(tx) {
                        rows.forEach(function(row) {
                            var sql = "INSERT INTO `units` (id,name,fc) VALUES (?,?,?)";
                            var data = [row.id, row.name, row.egi.fc];
                            tx.executeSql(sql, data);
                        });
                    },
                    function(e) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Failed to fetch unit list. '+e.message);
                    },
                    function() {
                        window.plugins.spinnerDialog.hide();
                        // navigator.notification.alert('Unit list fetched OK : '+JSON.stringify(rows));
                    }
                );
            }
        });
    },

    getFuelTank: function() {
        var t 	= this;

        $.ajax({
            url: localStorage.server_url + 'fuelTank',
            timeout: 3000,
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching fuel tank list...');
            },
            error: function(e) {
                t.sync_status = false;
            },
            success: function(rows) {
                var sql = []
        		sql.push("DROP TABLE IF EXISTS `fuel_tanks`");
        		sql.push("CREATE TABLE `fuel_tanks` ("+
                    "`id` integer PRIMARY KEY AUTOINCREMENT,"+
                    "`name` varchar(100) NOT NULL"+
                ")");

        		t.db.sqlBatch(sql, function() {
        			window.plugins.spinnerDialog.hide();
                }, function(e) {
        			window.plugins.spinnerDialog.hide();
                    navigator.notification.alert('Error create table : '+ e.message);
                });

                t.db.transaction(function(tx) {
                        rows.forEach(function(row) {
                            var sql = "INSERT INTO `fuel_tanks` (id,name) VALUES (?,?)";
                            var data = [row.id, row.name];
                            tx.executeSql(sql, data);
                        });
                    },
                    function(e) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Failed to fetch fuel tank list. '+e.message);
                    },
                    function() {
                        window.plugins.spinnerDialog.hide();
                        // navigator.notification.alert('Fuel tank list fetched OK : '+JSON.stringify(rows));
                    }
                );
            }
        });
    },

	getLastTransaction: function() {
        var t = this;
        $.ajax({
            url: localStorage.server_url + 'fuelRefill',
            timeout: 3000,
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching last transaction...');
            },
            error: function(e) {
                t.sync_status = false;
            },
            success: function(rows) {
                t.truncate_table('last_trx');
                t.db.transaction(function(tx) {
                        rows.forEach(function(row) {
                            var sql = "INSERT INTO `last_trx` (date, shift, fuel_tank_id, unit_id, employee_id, start_time, finish_time, hm, km, hm_last, km_last, total_real, total_recommended, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

							var data = [
                                row.date,
                                row.shift,
								row.fuel_tank_id,
								row.unit_id,
								row.employee_id,
								row.start_time,
								row.finish_time,
								row.hm,
                                row.km,
                                row.hm_last,
                                row.km_last,
								row.total_real,
								row.total_recommended,
                                row.user_id
							];

                            tx.executeSql(sql, data);
                        });
                    },
                    function(e) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Failed to fetch last transaction. '+e.message);
                    },
                    function() {
                        window.plugins.spinnerDialog.hide();
                        // navigator.notification.alert('Last transaction fetched OK : '+JSON.stringify(rows));
                    }
                );
            }
        });
    },

	registerDevice: function() {
        var t = this;

        var ft = $('#fuel-tank-name').val();
        if (ft == '') {
            navigator.notification.alert('Nama Fuel Tank tidak boleh kosong');
            return;
        }

        // validasi dulu biar ga ngaco ngisi fuel tank-nya
        t.db.transaction(function(tx) {
            var sql = 'SELECT * FROM `fuel_tanks` WHERE `name` LIKE ? LIMIT 1';
            tx.executeSql(sql, [ft], function(tx,r) {
                if (r.rows.length == 0) {
                    navigator.notification.alert('Fuel tank tidak terdaftar. Pastikan sudah sinkronisasi.');
                    return;
                }

				var fuelTank 				= r.rows.item(0);
				localStorage.fuel_tank_id 	= fuelTank.id;
				localStorage.fuel_tank_name = fuelTank.name;
				localStorage.is_registered	= 'true';

				t.goTo('admin.html', 'replace').then(function() {
					navigator.notification.alert('Device untuk fuel tank '+localStorage.fuel_tank_name+' BERHASIL ditambahkan.');
				});

            }, function(tx,e) {
                navigator.notification.alert('Failed to check unit '+e.message);
            });
        });
    },

    get_db_connection: function() {
        this.db = window.sqlitePlugin.openDatabase({
            name: "imis_fuel.db",
            location: "default",
            androidDatabaseImplementation: 2,
            androidLockWorkaround: 1
        });
    },

    truncate_table: function(tbl) {
        this.db.transaction(function(tx) {
            tx.executeSql("DELETE FROM `"+tbl+"`", [],
                function(tx,r) {console.log('TABLE '+tbl+' TRUNCATED');},
                function(tx,e) {console.log(e);}
            );
        });
    },

    init_db: function() {
        var sql = [];

        sql.push("CREATE TABLE `fuel_refills` ("+
            "`id` integer PRIMARY KEY AUTOINCREMENT,"+
            "`date` date NOT NULL,"+
            "`fuel_tank_id` integer NOT NULL,"+
            "`unit_id` integer NOT NULL,"+
            "`shift` integer(1) NOT NULL,"+
            "`total_recommended` integer DEFAULT NULL,"+
            "`total_real` integer NOT NULL,"+
            "`km` integer NOT NULL,"+
            "`hm` integer NOT NULL,"+
            "`km_last` integer DEFAULT NULL,"+
            "`hm_last` integer DEFAULT NULL,"+
            "`employee_id` integer NOT NULL,"+
            "`start_time` time NOT NULL,"+
            "`finish_time` time NOT NULL,"+
            "`uploaded` integer DEFAULT 0,"+
            "`user_id` integer NOT NULL"+
        ")");

        sql.push("CREATE TABLE `last_trx` ("+
            "`id` integer PRIMARY KEY AUTOINCREMENT,"+
            "`date` date NOT NULL,"+
            "`fuel_tank_id` integer NOT NULL,"+
            "`unit_id` integer NOT NULL,"+
            "`shift` integer(1) NOT NULL,"+
            "`total_recommended` integer DEFAULT NULL,"+
            "`total_real` integer NOT NULL,"+
            "`km` integer NOT NULL,"+
            "`hm` integer NOT NULL,"+
            "`km_last` integer DEFAULT NULL,"+
            "`hm_last` integer DEFAULT NULL,"+
            "`employee_id` integer NOT NULL,"+
            "`start_time` time NOT NULL,"+
            "`finish_time` time NOT NULL,"+
            "`user_id` integer NOT NULL"+
        ")");

        sql.push("CREATE TABLE `users` ("+
            "`id` integer,"+
            "`email` varchar(100) NOT NULL,"+
            "`password` varchar(100) NULL,"+
            "`name` varchar(100) NOT NULL"+
        ")");

        window.plugins.spinnerDialog.show(null, 'Preparing...');

        this.db.sqlBatch(sql, function() {
			localStorage.dbPopulated = 'true';
			window.plugins.spinnerDialog.hide();
        }, function(e) {
			window.plugins.spinnerDialog.hide();
            navigator.notification.alert('Error create table : '+ e.message);
        });

    }
};

app.initialize();
