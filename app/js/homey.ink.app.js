var CLIENT_ID = '5cbb504da1fc782009f52e46';
var CLIENT_SECRET = 'gvhs0gebgir8vz8yo2l0jfb49u9xzzhrkuo1uvs8';

window.addEventListener('load', function() {
  
  var homey;
  var me;
  var sunrise = "";
  var sunset = "";
  var tod = "";
  var dn = "";
  var batteryWarning =[];
  
  var $container = document.getElementById('container');
  var $header = document.getElementById('header');
  var $infopanel = document.getElementById('info-panel');
  var $text = document.getElementById('text');
  var $textLarge = document.getElementById('text-large');
  var $textSmall = document.getElementById('text-small');
  var $logo = document.getElementById('logo');
  var $batterywarning = document.getElementById('battery-warning');
  var $weather = document.getElementById('weather');
  var $weatherTemperature = document.getElementById('weather-temperature');
  var $weatherState = document.getElementById('weather-state');
  var $weatherStateIcon = document.getElementById('weather-state-icon');
  var $sunevents = document.getElementById('sun-events');
  var $sunrisetime = document.getElementById('sunrise-time');
  var $sunsettime = document.getElementById('sunset-time');
  var $flowsInner = document.getElementById('flows-inner');
  var $devicesInner = document.getElementById('devices-inner');

  $infopanel.addEventListener('click', function() {
    $container.classList.remove('container-dark');
    $infopanel.style.visibility = "hidden";
  });

  $logo.addEventListener('click', function(){
    window.location.reload();
  });

  $text.addEventListener('click', function() {
    homey.notifications.getNotifications().then(function(notifications) {
      return renderInfoPanel('t',notifications);
    })
  });

  $weather.addEventListener('click', function() {
    homey.weather.getWeather().then(function(weather) {
      return renderInfoPanel("w", weather)
    }).catch(console.error);
  })

  $sunevents.addEventListener('click', function() {
    homey.weather.getWeather().then(function(weather) {
      return renderInfoPanel("w", weather)
    }).catch(console.error);
  })

  $batterywarning.addEventListener('click', function() {
    return renderInfoPanel("b")
  })

  renderText();
  later.setInterval(function(){
    renderText();
  }, later.parse.text('every 1 hour'));

  var api = new AthomCloudAPI({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  });
  
  var theme = getQueryVariable('theme');
  var $css = document.createElement('link');
  $css.rel = 'stylesheet';
  $css.type = 'text/css';
  $css.href = './css/themes/' + theme + '.css';
  document.head.appendChild($css);
  
  var token = getQueryVariable('token');
  token = atob(token);
  token = JSON.parse(token);
  api.setToken(token);
  
  api.isLoggedIn().then(function(loggedIn) {
    if(!loggedIn)
      throw new Error('Token Expired. Please log-in again.');
  }).then(function(){
    return api.getAuthenticatedUser();
  }).then(function(user) {
    return user.getFirstHomey();
  }).then(function(homey) {
    return homey.authenticate();
  }).then(function(homey_) {
    homey = homey_;
    
    renderHomey();    
    later.setInterval(function(){
      renderHomey();
    }, later.parse.text('every 1 hour'));
  }).catch(console.error);

  function renderHomey() {
    homey.users.getUserMe().then(function(user) {
      me = user;
      me.properties = me.properties || {};
      me.properties.favoriteFlows = me.properties.favoriteFlows || [];
      me.properties.favoriteDevices = me.properties.favoriteDevices || [];
      
      homey.i18n.getOptionLanguage().then(function(language) {
        console.log(language)
      }).catch(console.error);

      homey.flowToken.getFlowTokens().then(function(tokens) {
        for (let token in tokens) {
          if ( tokens[token].id == "sunrise" ) {
            sunrise = tokens[token].value
          }
          if ( tokens[token].id == "sunset"  ) {
            sunset = tokens[token].value
          }
          if ( tokens[token].id == "alarm_battery" && tokens[token].value == true ) {
            var batteryLevel
            for (let ttoken in tokens) {
              if (tokens[ttoken].uriObj.id == tokens[token].uriObj.id && tokens[ttoken].id == "measure_battery" ) {
                batteryLevel = tokens[ttoken].value
              }
            }
            var element = {}
            element.name = tokens[token].uriObj.name
            element.zone = tokens[token].uriObj.meta.zoneName
            element.level = batteryLevel
            batteryWarning.push(element)
          }
        }
        if (sunrise != "" || sunset != "") {
          calculateTOD();
          renderSunevents();
        }
        if ( Object.keys(batteryWarning).length ) {
          console.log("Waarschuwing")
          $batterywarning.style.visibility = "visible";
        } else {
          console.log("Geen waarschuwing")
          $batterywarning.style.visibility = "hidden";
        }
      }).catch(console.error);

      homey.weather.getWeather().then(function(weather) {
        return renderWeather(weather);
      }).catch(console.error);
      
      homey.flow.getFlows().then(function(flows) {
        var favoriteFlows = me.properties.favoriteFlows.map(function(flowId){
          return flows[flowId];
        }).filter(function(flow){
          return !!flow;
        });
        return renderFlows(favoriteFlows);        
      }).catch(console.error);
      
      homey.devices.getDevices().then(function(devices) {
        var favoriteDevices = me.properties.favoriteDevices.map(function(deviceId){
          return devices[deviceId];
        }).filter(function(device){
          return !!device;
        }).filter(function(device){
          if(!device.ui) return false;
          if(!device.ui.quickAction) return false;
          return true;
        });
        
        favoriteDevices.forEach(function(device){
          device.makeCapabilityInstance(device.ui.quickAction, function(value){
            var $device = document.getElementById('device-' + device.id);
            if( $device ) {
              $device.classList.toggle('on', !!value);
            }
          });
        });
        
        return renderDevices(favoriteDevices);
      }).catch(console.error);
    }).catch(console.error);
  }
  
  function renderInfoPanel(type,info) {
    switch(type) {
      case "t":
        $infopanel.innerHTML = 'Notifications';

        break;
      case "w": 
        $infopanel.innerHTML = '';
        var $infoPanelWeather = document.createElement('div');
        $infoPanelWeather.id = "infopanel-weather"
        $infopanel.appendChild($infoPanelWeather);
        $wi = "<center><h1>Weather information for " + info.city + "</h1><br />"
        $wi = $wi + "<h2>The current temperature is " + Math.round(info.temperature*10)/10 + " degrees, "
        $wi = $wi + "the humidity is " + Math.round(info.humidity*100) + "% and the pressure is "
        pressure = info.pressure + " "
        $wi = $wi + pressure.replace('.','') + " mbar</h2></center>";

        $infoPanelWeather.innerHTML = $wi

        var $infopanelState = document.createElement('div');
        $infopanelState.id = "weather-state"
        $infopanel.appendChild($infopanelState);
        $infopanelState.innerHTML = "";
        $infopanelState.classList.add('weather-state');
        var $icon = document.createElement('div');
        $icon.id = 'weather-state-icon';
        $icon.classList.add(info.state.toLowerCase());
        $icon.style.backgroundImage = 'url(../img/weather/' + info.state.toLowerCase() + dn + '.svg)';    
        $icon.style.webkitMaskImage = 'url(../img/weather/' + info.state.toLowerCase() + dn + '.svg)';

        $infopanelState.appendChild($icon)

        var $infoPanelSunevents = document.createElement('div');
        $infoPanelSunevents.id = "infopanel-sunevents"
        $infopanel.appendChild($infoPanelSunevents);

        switch(tod) {
          case 1:
            $se = "<center><h2>The sun will rise at " + sunrise + " and will set at " + sunset + "</h2></center>"
            break;
          case 2:
            $se = "<center><h2>The sun rose at " + sunrise + " and will set at " + sunset + "</h2></center>"
            break;
          case 3:
            $se = "<center><h2>The sun rose at " + sunrise + " and set at " + sunset + "</h2></center>"
            break;
          default:
            $se = "<center><h2>The sun rises at " + sunrise + " and set at " + sunset + "</h2></center>"
            break;
        }
        $infoPanelSunevents.innerHTML = $se

        break;
      case "b":
        $infopanel.innerHTML = '';
        var $infoPanelBattery = document.createElement('div');
        $infoPanelBattery.id = "infopanel-battery"
        $infopanel.appendChild($infoPanelBattery);
        $bi = "<center><h1>Battery information</h1><br />"
        $bi = $bi + "These devices have reported a low battery<br /><br />"
        for (let device in batteryWarning) {
          console.log(batteryWarning[device])
          $bi = $bi + "<h2>" + batteryWarning[device].name + " in " 
          $bi = $bi + batteryWarning[device].zone + " has "
          $bi = $bi + batteryWarning[device].level + "% left</h2>"
        }
        $infopanel.innerHTML = $bi

        break;
    }
    console.log("style")
    $infopanel.style.visibility = "visible";
    $container.classList.add('container-dark');
  }

  function renderSunevents() {
    $sunrisetime.innerHTML = sunrise;
    $sunsettime.innerHTML = sunset;
  }

  function renderWeather(weather) {
    $weatherTemperature.innerHTML = Math.round(weather.temperature);
    $weatherStateIcon.classList.add(weather.state.toLowerCase());
    $weatherStateIcon.style.backgroundImage = 'url(img/weather/' + weather.state.toLowerCase() + dn + '.svg)';    
    $weatherStateIcon.style.webkitMaskImage = 'url(img/weather/' + weather.state.toLowerCase() + dn + '.svg)';
  }
  
  function renderFlows(flows) {
    $flowsInner.innerHTML = '';
    flows.forEach(function(flow) {
      var $flow = document.createElement('div');
      $flow.id = 'flow-' + flow.id;
      $flow.classList.add('flow');
      $flow.addEventListener('click', function(){        
        if( $flow.classList.contains('running') ) return;
        homey.flow.triggerFlow({
          id: flow.id,
        }).then(function(){          
          
          $flow.classList.add('running');                
          setTimeout(function(){
            $flow.classList.remove('running');
          }, 3000);
        }).catch(console.error);
      });
      $flowsInner.appendChild($flow);
      
      var $play = document.createElement('div');
      $play.classList.add('play');
      $flow.appendChild($play);
      
      var $name = document.createElement('div');
      $name.classList.add('name');
      $name.innerHTML = flow.name;
      $flow.appendChild($name);
    });
  }
  
  function renderDevices(devices) {
    $devicesInner.innerHTML = '';
    devices.forEach(function(device) {
      var $device = document.createElement('div');
      $device.id = 'device-' + device.id;
      $device.classList.add('device');
      $device.classList.toggle('on', device.capabilitiesObj && device.capabilitiesObj[device.ui.quickAction] && device.capabilitiesObj[device.ui.quickAction].value === true);
      $device.addEventListener('click', function(){
        var value = !$device.classList.contains('on');
        $device.classList.toggle('on', value);
        homey.devices.setCapabilityValue({
          deviceId: device.id,
          capabilityId: device.ui.quickAction,
          value: value,
        }).catch(console.error);
      });
      $devicesInner.appendChild($device);
      
      var $icon = document.createElement('div');
      $icon.classList.add('icon');
      $icon.style.webkitMaskImage = 'url(https://icons-cdn.athom.com/' + device.iconObj.id + '-128.png)';
      $device.appendChild($icon);
      
      var $name = document.createElement('div');
      $name.classList.add('name');
      $name.innerHTML = device.name;
      $device.appendChild($name);
    });
  }
  
  function renderText() {
    var now = new Date();
    var hours = now.getHours();
    
    var tod;
    if( hours >= 18 ) {
      tod = 'evening';
    } else if( hours >= 12 ) {
      tod = 'afternoon';
    } else if( hours >= 6 ) {
      tod = 'morning';
    } else {
      tod = 'night';
    }
    
    $textLarge.innerHTML = 'Good ' + tod + '!';
    $textSmall.innerHTML = 'Today is ' + moment(now).format('dddd[, the ]Do[ of ]MMMM YYYY[.]');
  }
  
  function calculateTOD() {

    var d = new Date();
    var m = d.getMinutes();
    var h = d.getHours();
    if(h == '0') {h = 24}

    var currentTime = h+"."+m;
    console.log(currentTime)
    var time = sunrise.split(":");
    var hour = time[0];
    if(hour == '00') {hour = 24}
    var min = time[1];
    var sunriseTime = hour+"."+min;

    var time = sunset.split(":");
    var hour = time[0];
    if(hour == '00') {hour = 24}
    var min = time[1];
    var sunsetTime = hour+"."+min;

    if ( currentTime < sunriseTime  ) {
      tod = 1;
      dn = "n";
    } 
    else if ( currentTime < sunsetTime ) {
      tod = 2;
      dn = "";
    } else {
      tod = 3;
      dn = "n";
    }
  }

});