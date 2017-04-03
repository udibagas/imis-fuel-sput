var app = {

    db                  : null,
    user                : null,
    wifiConnection      : false,
    serverConnection    : false,
    serverIsBusy        : false,
    serverUrl           : 'http://192.168.43.95/phoenix/fuelApi',
	geoLog				: null,
	data				: {},

    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    onDeviceReady: function() {

		document.addEventListener("backbutton", function(e) {
			e.preventDefault();
			// THE MAGIC!!!
			navigator.notifikasi.alert('Perangkat ini adalah fasilitas untuk mendukung kinerja Anda. Mohon untuk menggunakan perangkat ini sebagaimana mestinya.');
		}, false);

		AndroidFullScreen.immersiveMode();
		window.plugins.insomnia.keepAwake();

        var t = this;


		if (localStorage.serverUrl == null) {
			localStorage.serverUrl = t.serverUrl;
		}

		if (localStorage.fuelTankName == null) {
			localStorage.fuelTankName = 'BELUM TERDAFTAR';
		}

		if (localStorage.cycle_time_standart == null) {
			localStorage.cycle_time_standart = 3;
		}

		if (localStorage.bensin_dalam_cycle_standart == null) {
			localStorage.bensin_dalam_cycle_standart = 60;
		}

		$('#fuel-tank-info').html(localStorage.fuelTankName);

		t.getDbConnection();
		t.watchGeolocation(); // buat update last position

		if (localStorage.dbPopulated == null) {
			t.initDb();
		}

        // redirect to main if already logged in
        if (localStorage.isLoggedIn == 'true') {
            t.goTo('form-fuel.html');
        }

        // buat ngecek koneksi server tiap 1 detik
        setInterval(function() {

			$('#local-data').html(localStorage.localData);

			// if (navigator.connection.type != Connection.WIFI) {
            //     t.wifiConnection 	= false;
            //     t.serverConnection 	= false;
			// 	t.serverIsBusy 		= false;
            //     $('#wifi-indicator, #server-indicator, #upload-indicator, #gps-indicator').hide();
            //     return;
            // }

            t.wifiConnection = true;
            $('#wifi-indicator').show();

            if (t.serverIsBusy == true) {
                $('#upload-indicator').show();
                return; // cukup sampai disini kalo sibuk
            }

            $('#upload-indicator').hide();

            if (t.serverConnection == true) {
				$('#server-indicator').show();

				if (localStorage.isRegistered == 'true') {
					t.upload();
				}
				// t.getLastTransaction();
            }

			else {

				$.ajax({
					url: localStorage.serverUrl,
					type: 'get', dataType: 'json', crossDomain: true,
					success: function(r) {
						t.serverConnection = true;
						$('#server-indicator').show();

						if (localStorage.isRegistered == 'true') {
							t.upload();
						}
						// t.getLastTransaction();
					},
					error: function(e) {
						t.serverConnection = false;
						$('#server-indicator').hide();
					}
				});
			}


        }, 1000);

    },

    // fungsi menampilkan halaman record yg belum terupload
    // main: function() {
    //     var t = this;
    //     t.goTo('main.html').then(function() {
    //         t.db.transaction(function(tx) {
    //             var sql = 'SELECT * FROM `fuel_refill`';
    //             tx.executeSql(sql, [], function(tx,r) {
    //                 for (var i = 0; i < r.rows.length; i++) {
    //                     // TODO: tampilkan data dalam bentuk list
    //                     $('#list').append('');
    //                 }
    //             });
    //         });
    //     });
    // },

    input: function() {
        var t = this;
		var total_realisasi = $('#total_realisasi').val();
		var total_liter = $('#total_liter').val();
		var hm_last = $('#hm_last').val();
		var km_last = $('#km_last').val();
		var unit = $('#unit').val();
		var hm = $('#hm').val();
		var km = $('#km').val();

		if (total_realisasi == '') {
			alert('Total realisasi tidak boleh kosong');
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
			navigator.notification.alert('Silakan review terlebih dahulu sebelum melakukan otorisasi');

			// ini buat disimpan kemudian
			t.data.total_realisasi	= total_realisasi,
			t.data.total_liter		= total_liter,
			t.data.hm_last			= hm_last,
			t.data.km_last			= km_last
			t.data.hm				= hm,
			t.data.km				= km,

			$('#km').html(km);
			$('#hm').html(hm);
			$('#hm_last').html(hm_last);
			$('#km_last').html(km_last);
			$('#total_liter').html(total_liter);
			$('#unit').html(unit.toUpperCase());
			$('#total_realisasi').html(total_realisasi);

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
			var sql = 'SELECT * FROM `employee` WHERE `nrp` LIKE ? LIMIT 1';
			tx.executeSql(sql, [nrp], function(tx,r) {
				if (r.rows.length == 0) {
					navigator.notification.alert('Operator tidak terdaftar');
					return;
				}

				var operator = r.rows.item(0);

				ons.notification.alert({
					message: 'Anda yakin akan melakukan otorisasi, '+operator.nama+'?',
					title: 'OTORISASI',
					buttonLabels: ['TIDAK', 'YA'],
					callback: function(btn) {
						if (btn == 1) {
							var now = new Date();

							var data = [
								localStorage.fuelTankId,
								t.data.equipment_id,
								nrp.toUpperCase(),
								t.dateToYmdHis(now, 'Ymd'),
								t.data.time_fill_start,
								t.dateToYmdHis(now, 'His'),
								t.data.hm,
								t.data.km,
								t.data.hm_last,
								t.data.km_last,
								t.data.total_realisasi,
								t.data.total_liter,
								t.getShift(),
								localStorage.username,
								localStorage.username,
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
			var sql = 'INSERT INTO `fuel_refill` (fuel_tank_id, equipment_id, nrp, date_fill, time_fill_start, time_fill_end, hm, km, hm_last, km_last, total_realisasi, total_liter, shift, insert_by, realisasi_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

			tx.executeSql(sql, data, function(tx,rr) {
				// reset page
				t.goTo('form-fuel.html', 'reset').then(function() {
					navigator.notification.alert('Otorisasi BERHASIL! Data berhasil disimpan.');
					t.data = {};
					$('#wifi-indicator, #server-indicator, #upload-indicator, #gps-indicator').hide();
					$('#fuel-tank').val(localStorage.fuelTankName);
				});

			}, function(tx,e) {
				navigator.notification.alert('Gagal menyimpan data.' + e.message);
			});
		});
	},

	// buat ngambil data hm last & km last & last ct
	getLastHmKm: function(unit) {
		var t = this;
		t.db.transaction(function(tx) {
			tx.executeSql('SELECT * FROM equipment WHERE name LIKE ? LIMIT 1', [unit], function(tx,r) {
				if (r.rows.length > 0) {
					var equipment = r.rows.item(0);
					var now = new Date();
					t.data.equipment_id = equipment.id;
					t.data.time_fill_start = t.dateToYmdHis(now, 'His');

					// last HM & KM
					var sql = 'SELECT * FROM `last_transaction` WHERE `equipment_id` = ? LIMIT 1';
					tx.executeSql(sql, [equipment.id], function(tx,rr) {
						var trx = (rr.rows.length > 0) ? rr.rows.item(0) : false;

						if (trx != null) {
							$('#hm_last').val(trx.hm);
							$('#km_last').val(trx.km);
						}

					});

					// last CT
					// var sql = 'SELECT * FROM `daily_absent` WHERE `equipment_id` = ? LIMIT 1 ORDER BY date_insert DESC LIMIT 1';
					// tx.executeSql(sql, [equipment.id], function(tx,rr) {
					// 	var ct = (rr.rows.length > 0) ? rr.rows.item(0) : null;
					//
					// 	if (ct != null) {
					// 		var solarTerpakai = (ct.total_cycle_time / localStorage.cycle_time_standart) * localStorage.bensin_dalam_cycle_standart;
					// 		var solarTersedia = localStorage.bensin_dalam_cycle_standart - solarTerpakai;
					// 		var pengisian = localStorage.bensin_dalam_cycle_standart - solarTersedia;
					//
					// 		$('#last_ct').val(ct.total_cycle_time);
					// 		$('#total_liter').val(pengisian);
					// 	}
					// });
				}

				else {
					navigator.notification.alert('Unit tidak terdaftar');
				}

			}, function(tx,e) {
				navigator.notification.alert('Unit tidak terdaftar');
			});

		});
	},

	hitungTotalLiter: function(hm) {
		var totalLiter = (hm - $('#hm_last').val()) * 19.5;
		$('#total_liter').val(totalLiter);
	},

	getShift: function() {
		// 06.01 => 18.00 S1
		// 18.01 => 06.00 S2

		var now = new Date();
		var jam = now.getHours();

		return (jam >= 6 && jam <= 18) ? 1 : 2;
	},

	// upload data transaksi & last position
    upload: function() {
        var t = this;
		t.db.executeSql('SELECT * FROM `fuel_refill` ORDER BY `id` ASC LIMIT 50', [], function(r) {

			// if (r.rows.length == 0) {return;}

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
				url: localStorage.serverUrl + '/upload',
				data: {rows:rows},
				crossDomain: true, type: 'post', dataType: 'json',
				beforeSend: function() {
					t.serverIsBusy = true; // biar pada ngantri
					$('#upload-indicator').show();
				},
				success: function(res) {
					$('#upload-indicator').hide();
					t.db.transaction(function(tx) {
						tx.executeSql('DELETE FROM `fuel_refill` WHERE id IN ('+idToDelete+')', [],
							function(tx,result) {
								// Reset counter local data (hanya log_geolocation aja yg penting)
								tx.executeSql('SELECT id FROM `fuel_refill`', [], function(tx,r) {
									localStorage.localData = r.rows.length;
									$('#local-data').html(localStorage.localData);
								});
							},
							function(tx,error) {
							}
						);
					});
					// taruh paling bawah, pastikan data di local terhapus dulu
					t.serverIsBusy = false; // ready to serve again
				},
				error: function(e) {
					$('#upload-indicator').hide();
					t.serverIsBusy = false; // ready to serve again
					t.serverConnection = false; // asumsi saja, biar di cek lagi
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
			$('#wifi-indicator, #server-indicator, #upload-indicator, #gps-indicator').hide();
			$('#fuel-tank').val(localStorage.fuelTankName);
		});
	},

    login: function() {

        var t = this;
        var username = $('#username').val();
        var password = $('#password').val();

        if (username == '' || password == '') {
            navigator.notification.alert('Username dan password tidak boleh kosong');
            return;
        }

        t.db.transaction(function(tx) {

            var sql = 'SELECT * FROM user WHERE username LIKE ? AND password = ? LIMIT 1';
            tx.executeSql(sql, [username, CryptoJS.MD5(password)], function(tx,r) {

                if (r.rows.length == 0) {
                    navigator.notification.alert('Username atau password salah.');
                    return;
                }

                t.goTo('form-fuel.html', 'reset').then(function() {

					t.user 					= r.rows.item(0);
					localStorage.name 		= t.user.name;
					localStorage.username 	= t.user.username;
					localStorage.isLoggedIn = 'true';

					navigator.notification.alert('Selamat Datang, '+ t.user.username);
					$('#wifi-indicator, #server-indicator, #upload-indicator, #gps-indicator').hide();
					$('#fuel-tank').val(localStorage.fuelTankName);

                });

            }, function(tx,e) {
                navigator.notification.alert('Login gagal '+e.message);
            });

        });

    },

	scanNrp: function() {
        cordova.plugins.barcodeScanner.scan(
            function (r) {
                $("#nrp").val(r.text);
            },
            function (e) {
                navigator.notification.alert("Scanning GAGAL: " + e);
            },
            {
                "preferFrontCamera" : true, // iOS and Android
                "showFlipCameraButton" : true, // iOS and Android
                "prompt" : "Place a barcode inside the scan area", // supported on Android only
                "formats" : "QR_CODE,PDF_417", // default: all but PDF_417 and RSS_EXPANDED
                "orientation" : "landscape" // Android only (portrait|landscape), default unset so it rotates with the device
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
						localStorage.username = null;
						localStorage.isLoggedIn = 'false';
						$('#upload-indicator, #server-indicator, #wifi-indicator, #gps-indicator').hide();
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
						$('#upload-indicator, #server-indicator, #wifi-indicator, #gps-indicator').hide();
						$('#fuel-tank-info').html(localStorage.fuelTankName);
                    });
                }
            }
        });
    },

	setServerUrl: function() {
        var t = this;
        var serverUrl = $('#server-url').val();

        if (serverUrl == '') {
            navigator.notification.alert('Server URL tidak boleh kosong');
        } else {
            t.goTo('admin.html', 'replace').then(function() {
	            t.serverUrl = localStorage.serverUrl = serverUrl;
				// cek koneksi
				$.ajax({
                    url: localStorage.serverUrl,
                    type: 'get', dataType: 'json', crossDomain: true,
					beforeSend: function() {
						window.plugins.spinnerDialog.show(null, 'Checking server connection...')
					},
                    success: function(r) {
                        t.serverConnection = true;
						window.plugins.spinnerDialog.hide();
						navigator.notification.alert('Connection to server SUCCESS. ' + serverUrl);
                    },
                    error: function(e) {
                        t.serverConnection = false;
						window.plugins.spinnerDialog.hide();
						navigator.notification.alert('Connection to server FAILED. ' + serverUrl);
                    }
                });

			});
        }
    },

	sinkronisasi: function() {
		if (this.serverConnection == false) {
			navigator.notification.alert('Tidak terhubung ke server. Cek koneksi wifi.');
			return;
		}

        this.getUser();
		// this.getSetting();
		this.getEmployee();
		this.getFuelTank();
        this.getEquipment();
        this.getLastTransaction();
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

		window.open(localStorage.serverUrl + '/update', '_blank');
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

    getUser: function() {
        var t 	= this;
		var sql = []

		window.plugins.spinnerDialog.show(null, 'Creating user table...');

		sql.push("DROP TABLE IF EXISTS `user`");

		sql.push("CREATE TABLE `user` ("+
            "`id` integer PRIMARY KEY AUTOINCREMENT,"+
            "`name` varchar(100) NOT NULL,"+
            "`username` varchar(100) NOT NULL,"+
            "`password` varchar(100) NOT NULL"+
        ")");

		t.db.sqlBatch(sql, function() {
			window.plugins.spinnerDialog.hide();
        }, function(e) {
			window.plugins.spinnerDialog.hide();
            navigator.notification.alert('Error create table : '+ e.message);
        });

        $.ajax({
            url: localStorage.serverUrl + '/getUser',
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching user list...');
            },
            success: function(rows) {
                t.db.transaction(function(tx) {
                        rows.forEach(function(row) {
                            var sql = "INSERT INTO `user` (id,name,username,password) VALUES (?,?,?,?)";
                            var data = [row.id, row.name, row.username, row.password];
                            tx.executeSql(sql, data);
                        });
                    },
                    function(e) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Failed to fetch user list. '+e.message);
                    },
                    function() {
                        window.plugins.spinnerDialog.hide();
                        // navigator.notification.alert('User list fetched OK : '+JSON.stringify(rows));
                    }
                );
            }
        });
    },

    getEmployee: function() {
        var t = this;
		var sql = []

		window.plugins.spinnerDialog.show(null, 'Creating employee table...');

		sql.push("DROP TABLE IF EXISTS `employee`");

		sql.push("CREATE TABLE `employee` ("+
            "`id` integer PRIMARY KEY AUTOINCREMENT,"+
            "`nrp` varchar(100) NOT NULL,"+
            "`nama` varchar(100) NOT NULL"+
        ")");

		t.db.sqlBatch(sql, function() {
			window.plugins.spinnerDialog.hide();
        }, function(e) {
			window.plugins.spinnerDialog.hide();
            navigator.notification.alert('Error create table : '+ e.message);
        });

        $.ajax({
            url: localStorage.serverUrl + '/getEmployee',
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching employee list...');
            },
            success: function(rows) {
                t.db.transaction(function(tx) {
                        rows.forEach(function(row) {
                            var sql = "INSERT INTO `employee` (id,nrp,nama) VALUES (?,?,?)";
                            var data = [row.id, row.nrp, row.nama];
                            tx.executeSql(sql, data);
                        });
                    },
                    function(e) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Failed to fetch user list. '+e.message);
                    },
                    function() {
                        window.plugins.spinnerDialog.hide();
                        // navigator.notification.alert('User list fetched OK : '+JSON.stringify(rows));
                    }
                );
            }
        });
    },

    getEquipment: function() {
        var t 	= this;
		var sql = []

		window.plugins.spinnerDialog.show(null, 'Creating equipment table...');

		sql.push("DROP TABLE IF EXISTS `equipment`");

		sql.push("CREATE TABLE IF NOT EXISTS `equipment` ("+
            "`id` integer PRIMARY KEY AUTOINCREMENT,"+
            "`name` varchar(100) NOT NULL"+
        ")");

		t.db.sqlBatch(sql, function() {
			window.plugins.spinnerDialog.hide();
        }, function(e) {
			window.plugins.spinnerDialog.hide();
            navigator.notification.alert('Error create table : '+ e.message);
        });

        $.ajax({
            url: localStorage.serverUrl + '/getEquipment',
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching quipment list...');
            },
            success: function(rows) {
                t.db.transaction(function(tx) {
                        rows.forEach(function(row) {
                            var sql = "INSERT INTO `equipment` (id,name) VALUES (?,?)";
                            var data = [row.id, row.name];
                            tx.executeSql(sql, data);
                        });
                    },
                    function(e) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Failed to fetch equipment list. '+e.message);
                    },
                    function() {
                        window.plugins.spinnerDialog.hide();
                        // navigator.notification.alert('Equipment list fetched OK : '+JSON.stringify(rows));
                    }
                );
            }
        });
    },

    // getSetting: function() {
    //     var t = this;
    //     $.ajax({
    //         url: localStorage.serverUrl + '/getSetting',
    //         type: 'get', crossDomain: true, dataType: 'json',
    //         beforeSend: function() {
    //             window.plugins.spinnerDialog.show(null, 'Fetching setting...');
    //         },
    //         success: function(row) {
    //             t.truncateTable('setting');
    //             t.db.transaction(function(tx) {
	// 				var sql = "INSERT INTO `setting` (cycle_time_standart,bensin_dalam_cycle_standart) VALUES (?,?)";
	// 				var data = [row.cycle_time_standart, row.bensin_dalam_cycle_standart];
	//
	// 				tx.executeSql(sql, data, function(tx,r) {
	// 					localStorage.cycle_time_standart = row.cycle_time_standart;
	// 					localStorage.bensin_dalam_cycle_standart = row.bensin_dalam_cycle_standart;
	// 				});
    //             },
    //             function(e) {
    //                 window.plugins.spinnerDialog.hide();
    //                 navigator.notification.alert('Failed to fetch settings. '+e.message);
    //             },
    //             function() {
    //                 window.plugins.spinnerDialog.hide();
    //                 navigator.notification.alert('Settings fetched OK : '+JSON.stringify(row));
    //             });
    //         }
    //     });
    // },

    getFuelTank: function() {
        var t 	= this;
		var sql = []

		window.plugins.spinnerDialog.show(null, 'Creating fuel_tank table...');

		sql.push("DROP TABLE IF EXISTS `fuel_tank`");

		sql.push("CREATE TABLE `fuel_tank` ("+
            "`id` integer PRIMARY KEY AUTOINCREMENT,"+
            "`name` varchar(100) NOT NULL,"+
            "`latitude` dec(9,6) NULL,"+
            "`longitude` dec(9,6) NULL,"+
			"`altitude` decimal(6,2) NULL DEFAULT '0.00',"+
            "`heading` decimal(5,2) NULL DEFAULT '0.00',"+
            "`speed` decimal(5,2) NULL DEFAULT '0.00',"+
			"`accuracy` integer NULL DEFAULT '999999',"+
            "`timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP"+
        ")");

		t.db.sqlBatch(sql, function() {
			window.plugins.spinnerDialog.hide();
        }, function(e) {
			window.plugins.spinnerDialog.hide();
            navigator.notification.alert('Error create table : '+ e.message);
        });

        $.ajax({
            url: localStorage.serverUrl + '/getFuelTank',
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching fuel tank list...');
            },
            success: function(rows) {
                t.db.transaction(function(tx) {
                        rows.forEach(function(row) {
                            var sql = "INSERT INTO `fuel_tank` (id,name) VALUES (?,?)";
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
            url: localStorage.serverUrl + '/getLastTransaction',
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching last transaction...');
            },
            success: function(rows) {
                t.truncateTable('last_transaction');
                t.db.transaction(function(tx) {
                        rows.forEach(function(row) {
                            var sql = "INSERT INTO `last_transaction` (fuel_tank_id, equipment_id, nrp, date_instruksi, date_fill, time_fill_start, time_fill_end, hm, total_liter, total_realisasi, shift, km, hm_last, km_last) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

							var data = [
								row.fuel_tank_id,
								row.equipment_id,
								row.nrp,
								row.date_instruksi,
								row.date_fill,
								row.time_fill_start,
								row.time_fill_end,
								row.hm,
								row.total_liter,
								row.total_realisasi,
								row.shift,
								row.km,
								row.hm_last,
								row.km_last
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

	getDailyAbsent: function() {
        var t = this;
        $.ajax({
            url: localStorage.serverUrl + '/getDailyAbsent',
            type: 'get', crossDomain: true, dataType: 'json',
            beforeSend: function() {
                window.plugins.spinnerDialog.show(null, 'Fetching daily absent...');
            },
            success: function(rows) {
                t.truncateTable('daily_absent');
                t.db.transaction(function(tx) {
                        rows.forEach(function(row) {
                            var sql = "INSERT INTO `daily_absent` (nip, date, date_out, time_in, time_out, shift, total_cycle_time, unit, hm_awal, hm_akhir, date_insert, equipment_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";

							var data = [
								row.nip,
								row.date,
								row.date_out,
								row.time_in,
								row.time_out,
								row.shift,
								row.total_cycle_time,
								row.unit,
								row.hm_awal,
								row.hm_akhir,
								row.date_insert,
								row.equipment_id
							];

                            tx.executeSql(sql, data);
                        });
                    },
                    function(e) {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Failed to fetch daily absent. '+e.message);
                    },
                    function() {
                        window.plugins.spinnerDialog.hide();
                        navigator.notification.alert('Daily absent fetched OK : '+JSON.stringify(rows));
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
            var sql = 'SELECT * FROM `fuel_tank` WHERE `name` LIKE ? LIMIT 1';
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

	// pastikan hanya memanggil fungsi ini sekali!!!
    watchGeolocation: function() {
        var t = this;
        AdvancedGeolocation.start(function(success) {
            try {
                t.geoLog = JSON.parse(success);

                if (t.geoLog.provider == 'gps') {

					if (localStorage.isRegistered == 'true') {
						t.updateLastPosition();
					}

                    $('#gps-indicator').show();

                }

				else {
					t.geoLog = null;
					$('#gps-indicator').hide();
				}

            } catch(exc) {
				t.geoLog = null;
                $('#gps-indicator').hide();
				console.log('Invalid JSON:' + exc);
            }
        }, function(error) {
			t.geoLog = null;
            $('#gps-indicator').hide();
			console.log('ERROR!!!'  + JSON.stringify(error));
        }, {
            "minTime":10000,        // Min time interval between updates (ms)
            "minDistance":10,      // Min distance between updates (meters)
            "noWarn":true,         // Native location provider warnings
            "providers":"gps",     // Return GPS, NETWORK and CELL locations
            "useCache":false,       // Return GPS and NETWORK cached locations
            "satelliteData":false, // Return of GPS satellite info
            "buffer":false,        // Buffer location data
            "bufferSize":0         // Max elements in buffer
        });
    },

	updateLastPosition: function() {
		var t = this;
		t.db.transaction(function(tx) {
			var sql = 'UPDATE FROM fuel_tank SET latitude = ?, longitude = ?, heading = ? speed = ? altitude = ?, accuracy = ? timestamp = ? WHERE id = ?';

			var now = new Date();

			var data = [
                t.geoLog.latitude.toFixed(6),
                t.geoLog.longitude.toFixed(6),
                t.geoLog.bearing.toFixed(2),
				(t.geoLog.speed*60*60/1000).toFixed(2), // convert m/s to km/h
				t.geoLog.altitude.toFixed(2),
                t.geoLog.accuracy.toFixed(2),
				t.dateToYmdHis(now, 'YmdHis'),
				localStorage.fuelTankId
            ];

			tx.executeSql(sql, data, function(tx,r) {
				var sql = 'SELECT latitude, longitude, altitude, accuracy, heading, speed, timestamp FROM fuel_tank WHERE id = ?';

				tx.executeSql(sql, [localStorage.fuelTankId], function(tx,r) {

					ft = r.rows.item(0);

					var position = {
						latitude	: ft.latitude,
						longitude	: ft.longitude,
						altitude	: ft.altitude,
						accuracy	: ft.accuracy,
						heading		: ft.heading,
						speed		: ft.speed,
						timestamp	: ft.timestamp
					};

					// then ajax here
					$.ajax({
						url: localStorage.serverUrl + '/updateLastPosition',
						data: {id: localStorage.fuelTankId, position: JSON.stringify(position)},
						crossDomain: true, type: 'post', dataType: 'json',
						success: function(res) {
							// position updated
						}
					});

				}, function(tx,e) {
					alert(e.message);
				});

			}, function(tx,e) {
				alert('Failed update position '+e.message);
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
            tx.executeSql("TRUNCATE TABLE `"+tbl+"`", [],
                function(tx,r) {console.log('TABLE TRUNCATED');},
                function(tx,e) {console.log(e);}
            );
        });
    },

    initDb: function() {
        var sql = [];

        sql.push("CREATE TABLE IF NOT EXISTS `fuel_refill` ("+
            "`id` integer PRIMARY KEY AUTOINCREMENT,"+
			"`fuel_tank_id` integer NULL,"+
            "`equipment_id` integer NOT NULL,"+
            "`nrp` varchar(100) DEFAULT NULL,"+
            "`date_fill` date DEFAULT NULL,"+
            "`time_fill_start` time DEFAULT NULL,"+
            "`time_fill_end` time DEFAULT NULL,"+
            "`hm` float DEFAULT '0',"+
            "`hm_last` float DEFAULT '0',"+
            "`total_realisasi` double NOT NULL DEFAULT '0',"+
            "`total_liter` double NOT NULL DEFAULT '0',"+
            "`shift` integer(1) DEFAULT NULL,"+
            "`date_insert` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,"+
            "`date_realisasi` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,"+
            "`realisasi_by` varchar(100) DEFAULT NULL,"+
            "`insert_by` varchar(100) DEFAULT NULL,"+
            "`km` varchar(100) DEFAULT NULL,"+
            "`km_last` varchar(100) DEFAULT NULL"+
        ")");

        sql.push("CREATE TABLE IF NOT EXISTS `last_transaction` ("+
            "`id` integer PRIMARY KEY AUTOINCREMENT,"+
			"`fuel_tank_id` integer NULL,"+
            "`equipment_id` integer NOT NULL,"+
            "`nrp` varchar(100) DEFAULT NULL,"+
            "`date_instruksi` date DEFAULT NULL,"+
            "`date_fill` date DEFAULT NULL,"+
            "`time_fill_start` time DEFAULT NULL,"+
            "`time_fill_end` time DEFAULT NULL,"+
            "`hm` float DEFAULT '0',"+
            "`hm_last` float DEFAULT '0',"+
            "`total_liter` double NOT NULL DEFAULT '0',"+
            "`total_realisasi` double NOT NULL DEFAULT '0',"+
            "`shift` integer(1) DEFAULT NULL,"+
            "`date_insert` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,"+
            "`date_realisasi` timestamp NULL DEFAULT CURRENT_TIMESTAMP,"+
            "`realisasi_by` varchar(100) DEFAULT NULL,"+
			"`insert_by` varchar(100) DEFAULT NULL,"+
            "`km` varchar(100) DEFAULT NULL,"+
            "`km_last` varchar(100) DEFAULT NULL"+
        ")");

		// sql.push("CREATE TABLE IF NOT EXISTS `setting` ("+
		// 	"`id` integer PRIMARY KEY AUTOINCREMENT,"+
		// 	"`cycle_time_standart` varchar(10) NOT NULL,"+
		// 	"`bensin_dalam_cycle_standart` varchar(10) NOT NULL"+
		// ")");

		sql.push("CREATE TABLE IF NOT EXISTS `daily_absent` ("+
			"`id` integer PRIMARY KEY AUTOINCREMENT,"+
			"`nip` varchar(100) NOT NULL,"+
			"`date` date NOT NULL,"+
			"`date_out` date DEFAULT NULL,"+
			"`shift` varchar(10) DEFAULT NULL,"+
			"`time_in` time DEFAULT NULL,"+
			"`time_out` time DEFAULT NULL,"+
			"`total_cycle_time` decimal(10,2) NOT NULL DEFAULT '0.00',"+
			"`unit` varchar(100) DEFAULT NULL,"+
			"`equipment_id` integer DEFAULT NULL,"+
			"`hm_awal` varchar(10) DEFAULT NULL,"+
			"`hm_akhir` varchar(10) DEFAULT NULL,"+
			"`date_insert` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP"+
		")");

        window.plugins.spinnerDialog.show(null, 'Preparing...');

        this.db.sqlBatch(sql, function() {
			localStorage.dbPopulated = 'true';
			window.plugins.spinnerDialog.hide();
            // navigator.notification.alert('Database populated');
        }, function(e) {
			window.plugins.spinnerDialog.hide();
            navigator.notification.alert('Error create table : '+ e.message);
        });

    }
};

app.initialize();
