const apiKey = "abaf720864a2a4c6592323874d760056";

const weatherBtn = document.getElementById("weatherBtn");
const cityInput = document.getElementById("city");
const currentWeatherDiv = document.getElementById("currentWeather");
const forecastDiv = document.getElementById("forecast");

weatherBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (city) {
    getCurrentWeather(city);
    getForecast(city);
  } else {
    alert("Proszę wprowadzić nazwę miejscowości.");
  }
});

function getCurrentWeather(city) {
  const xhr = new XMLHttpRequest();
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
    city
  )}&appid=${apiKey}&units=metric&lang=pl`;

  xhr.open("GET", url, true);

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        displayCurrentWeather(data);
        changeBackgroundByTemperature(data.main.temp);
      } else {
        currentWeatherDiv.innerHTML =
          "<p>Błąd: Nie udało się pobrać danych pogodowych.</p>";
      }
    }
  };

  xhr.send();
}

function changeBackgroundByTemperature(temp) {
  document.body.classList.remove("cold", "cool", "warm", "hot");

  if (temp < 0) document.body.classList.add("cold");
  else if (temp >= 0 && temp < 15) document.body.classList.add("cool");
  else if (temp >= 15 && temp < 25) document.body.classList.add("warm");
  else document.body.classList.add("hot");
}

function displayCurrentWeather(data) {
  const iconUrl = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;

  currentWeatherDiv.innerHTML = `
    <h2>Aktualna pogoda dla ${data.name}</h2>
    <div class="weather-item">
      <img src="${iconUrl}" alt="Ikona pogody">
      <div class="weather-details">
        <p>Temperatura: ${data.main.temp}°C</p>
        <p>Opis: ${data.weather[0].description}</p>
      </div>
    </div>
  `;
}

function getForecast(city) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
    city
  )}&appid=${apiKey}&units=metric&lang=pl`;

  fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error("Błąd sieci");
      return response.json();
    })
    .then((data) => displayForecast(data))
    .catch(() => {
      forecastDiv.innerHTML = "<p>Błąd podczas pobierania prognozy!</p>";
    });
}

function displayForecast(data) {
  forecastDiv.innerHTML = "<h2>Prognoza pogody</h2>";

  let previousTemp = null;

  data.list.slice(0, 5).forEach((item) => {
    const date = new Date(item.dt * 1000).toLocaleString("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const iconUrl = `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`;

    let tempChange = "";
    if (previousTemp !== null) {
      if (item.main.temp > previousTemp)
        tempChange = '<span class="temperature-change up">↑</span>';
      else if (item.main.temp < previousTemp)
        tempChange = '<span class="temperature-change down">↓</span>';
    }
    previousTemp = item.main.temp;

    forecastDiv.innerHTML += `
      <div class="weather-item">
        <img src="${iconUrl}" alt="Ikona pogody">
        <div class="weather-details">
          <p>${date}</p>
          <p>Temperatura: ${item.main.temp}°C ${tempChange}</p>
          <p>Opis: ${item.weather[0].description}</p>
        </div>
      </div>
    `;
  });
}
