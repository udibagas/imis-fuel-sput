var app = {

    db                  : null,
    user                : null,
    wifiConnection      : false,
    serverConnection    : false,
    serverIsBusy        : false,
    serverUrl           : 'http://10.13.27.60/api/',
    // serverUrl           : 'http://192.168.104.228:8000/api/',
	geoLog				: null,
	data				: {},

    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    onDeviceReady: function() {
        var counter = 0;
		AndroidFullScreen.immersiveMode();
		window.plugins.insomnia.keepAwake();

        var t = this;

		if (localStorage.serverUrl == null) {
			localStorage.serverUrl = t.serverUrl;
		}

		if (localStorage.fuelTankName == null) {
			localStorage.fuelTankName = 'BELUM TERDAFTAR';
		}

		$('#fuel-tank-info').html(localStorage.fuelTankName);

		t.getDbConnection();

		if (localStorage.dbPopulated == null) {
			t.initDb();
		}

        // redirect to main if already logged in
        if (localStorage.isLoggedIn == 'true') {
            t.goTo('form-fuel.html').then(function() {
                $('#fuel-tank').html(localStorage.fuelTankName);
                $('#user').html(localStorage.name);
            });
        }

        // force upload every 1 sec
        setInterval(function() {
            if (localStorage.isRegistered == 'true') {
                t.upload();

                if (counter%300 == 0) {
                    t.sinkronisasi();
                }

                counter += 1;
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

		if (hm == '') {
			alert('HM tidak boleh kosong');
			return;
		}

		if (km == '') {
			alert('KM tidak boleh kosong');
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

                            var data = [
                                t.dateToYmdHis(now, 'Ymd'),
                                t.getShift(),
								localStorage.fuelTankId,
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
                                localStorage.userId
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
					$('#fuel-tank').html(localStorage.fuelTankName);
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
		// 07.01 => 19.00 S1
		// 19.01 => 07.00 S2

		var now = new Date();
		var jam = now.getHours();

		return (jam >= 7 && jam <= 19) ? 1 : 2;
	},

	// upload data transaksi
    upload: function() {
        if (navigator.connection.type != Connection.WIFI) {
            return;
        }

        var t = this;
		t.db.executeSql('SELECT * FROM `fuel_refills` WHERE `uploaded` = 0 ORDER BY `id` ASC LIMIT 50', [], function(r) {

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

			// then ajax here
			$.ajax({
				url: localStorage.serverUrl + 'fuelRefill',
				data: {rows:rows},
				crossDomain: true, type: 'post', dataType: 'json',
				success: function(res) {
					t.db.transaction(function(tx) {
						tx.executeSql('UPDATE `fuel_refills` SET `uploaded` = 1 WHERE id IN ('+idToDelete+')', [],
							function(tx,result) {
								// Reset counter local data (hanya log_geolocation aja yg penting)
								tx.executeSql('SELECT id FROM `fuel_refills` WHERE `uploaded` = 0', [], function(tx,r) {
									localStorage.localData = r.rows.length;
								});
							},
							function(tx,error) {
							}
						);
					});
				},
				error: function(e) {
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
		var t = this;

		t.goTo('form-fuel.html', 'reset').then(function() {
			$('#fuel-tank').html(localStorage.fuelTankName);
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

        t.db.transaction(function(tx) {
            window.plugins.spinnerDialog.show(null, 'Checking user locally...');
            tx.executeSql('SELECT * FROM users WHERE email LIKE ?', [email], function(tx, r) {
                if (r.rows.length == 0) {
                    window.plugins.spinnerDialog.hide();
                    navigator.notification.alert('User tidak terdaftar.');
                    return;
                }

                window.plugins.spinnerDialog.hide();
                t.user = r.rows.item(0);

                // kalau password-nya null harus ambil dari server
                if (!t.user.password) {
                    if (navigator.connection.type != Connection.WIFI) {
                        navigator.notification.alert('Tidak terhubung ke server. Cek koneksi Wifi.');
                        return;
                    }

                    window.plugins.spinnerDialog.show(null, 'Checking user on the server...');
                    $.ajax({
                        url: localStorage.serverUrl + 'login',
                        crossDomain: true, type: 'post', dataType: 'json',
                        data: {email:email, password:password},
                        success: function(res) {
                            window.plugins.spinnerDialog.hide();
                            window.plugins.spinnerDialog.show(null, 'Saving user to device...');
                            t.user = res;

                            tx.executeSql(
                                'UPDATE users SET password = ?, name = ? WHERE email LIKE ?',
                                [password, res.name, email],
                                function(tx, rr) {
                                    // nothing todo
                                }, function(tx, e) {
                                    // kecil kemungkinan
                                    alert('Failed to save user to device. ' + JSON.stringify(e));
                                    return;
                                }
                            );

                            window.plugins.spinnerDialog.hide();
                        },
                        error: function(e) {
                            window.plugins.spinnerDialog.hide();
                            navigator.notification.alert('Gagal login. Cek koneksi Wifi atau username/password salah.');
                            return;
                        }
                    });
                }

                else if (t.user.password != password) {
                    navigator.notification.alert('Password salah!');
                    return;
                }

            }, function(tx, e) {
                alert(JSON.stringify(e));
                return;
            });
        });

        t.goTo('form-fuel.html', 'reset').then(function() {
            localStorage.name 		= t.user.name;
            localStorage.email 	    = t.user.email;
            localStorage.userId 	= t.user.id;
            localStorage.isLoggedIn = 'true';

            $('#fuel-tank').html(localStorage.fuelTankName);
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
		var t = this;
        ons.notification.confirm('Anda yakin akan logout?', {
            title: 'LOGOUT',
            buttonLabels: ['TIDAK', 'LOGOUT'],
            callback: function(btn) {
                if (btn == 1) {
                    t.goTo('login.html', 'reset').then(function() {
						t.user = null;
						localStorage.name = null;
						localStorage.email = null;
						localStorage.isLoggedIn = 'false';
						localStorage.userId = null;
						$('#fuel-tank-info').html(localStorage.fuelTankName);
                    });
                }
            }
        });
    },

	admin: function() {
        var t = this;
        var pass = $('#admin-pass').val();

        if (pass != 'Kpp12345persada') {
            navigator.notification.alert('Password admin salah');
            return;
        }

		localStorage.adminIsLoggedIn = 'true';
		t.goTo('admin.html', 'replace');
    },

	logoutAdmin: function() {
        var t = this;
        ons.notification.confirm('Anda yakin akan logout dari halaman admin?', {
            title: 'LOGOUT',
            buttonLabels: ['TIDAK', 'LOGOUT'],
            callback: function(btn) {
                if (btn == 1) {
                    t.goTo('login.html', 'reset').then(function() {
                        localStorage.adminIsLoggedIn = 'false';
						$('#fuel-tank-info').html(localStorage.fuelTankName);
                    });
                }
            }
        });
    },

	setServerUrl: function() {
        if (navigator.connection.type != Connection.WIFI) {
            navigator.notification.alert('Check koneksi WIFI!');
            return;
        }

        var t = this;
        var serverUrl = $('#server-url').val();

        if (serverUrl == '') {
            navigator.notification.alert('Server URL tidak boleh kosong');
        } else {
            t.goTo('admin.html', 'replace').then(function() {
	            t.serverUrl = localStorage.serverUrl = serverUrl;
                $.ajax({
                    url: localStorage.serverUrl + 'ping',
                    type: 'get', dataType: 'json', crossDomain: true,
                    beforeSend: function() {
                        window.plugins.spinnerDialog.show(null, 'Checking server connection...')
                    },
                    success: function(r) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Connection to server SUCCESS. ' + serverUrl);
                    },
                    error: function(e) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Connection to server FAILED. ' + JSON.stringify(e));
                    }
                });
			});
        }
    },

    // test dulu sebelum sinkronisasi
	sinkronisasi: function() {
        if (navigator.connection.type != Connection.WIFI) {
            return;
        }

        var _this = this;
        $.ajax({
            url: localStorage.serverUrl + 'ping',
            type: 'get', dataType: 'json', crossDomain: true,
            success: function(r) {
                // _this.getUser();
                _this.getEmployee();
        		_this.getFuelTank();
                _this.getUnit();
                _this.getLastTransaction();
            },
        });
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

	update: function() {
		if (this.serverConnection == false) {
			navigator.notification.alert('Tidak terhubung ke server. Cek koneksi wifi.');
			return;
		}

		window.open(localStorage.serverUrl + 'update', '_blank');
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
            url: localStorage.serverUrl + 'employee',
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching employee list...');
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

    //  di eksekusi 1 kali saja waktu daftar device
    getUser: function() {
        var t = this;

        $.ajax({
            url: localStorage.serverUrl + 'user',
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching user list...');
            },
            success: function(rows) {
                t.db.transaction(function(tx) {
                        rows.forEach(function(row) {
                            var sql = "INSERT INTO `users` (id, email, name) VALUES (?,?,?)";
                            var data = [row.id, row.email, row.name];
                            tx.executeSql(sql, data);
                        });
                    },
                    function(e) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Failed to fetch user list. '+e.message);
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
            url: localStorage.serverUrl + 'unit',
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching unit list...');
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
            url: localStorage.serverUrl + 'fuelTank',
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching fuel tank list...');
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
            url: localStorage.serverUrl + 'fuelRefill',
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching last transaction...');
            },
            success: function(rows) {
                t.truncateTable('last_trx');
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
				localStorage.fuelTankId 	= fuelTank.id;
				localStorage.fuelTankName 	= fuelTank.name;
				localStorage.isRegistered	= 'true';

				t.goTo('admin.html', 'replace').then(function() {
					navigator.notification.alert('Device untuk fuel tank '+localStorage.fuelTankName+' BERHASIL ditambahkan.');
				});

            }, function(tx,e) {
                navigator.notification.alert('Failed to check unit '+e.message);
            });
        });
    },

    getDbConnection: function() {
        this.db = window.sqlitePlugin.openDatabase({
            name: "imis_fuel.db",
            location: "default",
            androidDatabaseImplementation: 2,
            androidLockWorkaround: 1
        });
    },

    truncateTable: function(tbl) {
        this.db.transaction(function(tx) {
            tx.executeSql("DELETE FROM `"+tbl+"`", [],
                function(tx,r) {console.log('TABLE '+tbl+' TRUNCATED');},
                function(tx,e) {console.log(e);}
            );
        });
    },

    initDb: function() {
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
