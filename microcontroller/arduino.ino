#include <WiFi.h>
#include <Wire.h>
#include <DHT.h>
#include <MPU6500_WE.h>
#include <PubSubClient.h>

// ---------------- WIFI CONFIGURATION ----------------

const char* ssid = "IIIT DHARWAD-STUDENT";
const char* password = "IIITDst!123456";

// Laptop IP address
const char* mqtt_server = "10.0.3.214";
const int mqtt_port = 1883;

// ---------------- MQTT CONFIGURATION ----------------

WiFiClient espClient;
PubSubClient mqttClient(espClient);

const char* mqtt_topic = "eiss2/sensors";

// ---------------- SENSOR CONFIGURATION ----------------

#define DHT_PIN 4
#define DHT_TYPE DHT11

#define GREEN_LED 25
#define RED_LED 26

DHT dht(DHT_PIN, DHT_TYPE);

MPU6500_WE motionSensor = MPU6500_WE(0x68);

bool motionSensorReady = false;

// ---------------- ADAPTIVE SAMPLING ----------------

const unsigned long NORMAL_INTERVAL = 5000;
const unsigned long ALERT_INTERVAL = 1000;

const unsigned long MOTION_CHECK_INTERVAL = 100;

const float MOTION_THRESHOLD = 0.20;

bool alertMode = false;
bool havePreviousReading = false;

float previousX = 0;
float previousY = 0;
float previousZ = 0;

unsigned long lastMotionCheck = 0;
unsigned long lastSensorRead = 0;
unsigned long lastMqttAttempt = 0;
unsigned long lastMotionDetected = 0;
const unsigned long ALERT_HOLD_TIME = 3000;    

// ---------------- WIFI CONNECTION ----------------

void connectWiFi() {

  Serial.println("Connecting to Wi-Fi...");

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  WiFi.begin(ssid, password);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 60) {

    delay(500);
    Serial.print(".");

    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("Wi-Fi connected!");

    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());

  } else {

    Serial.println("Wi-Fi connection failed!");
  }
}

// ---------------- MQTT CONNECTION ----------------

void reconnectMQTT() {

  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  if (mqttClient.connected()) {
    return;
  }

  if (millis() - lastMqttAttempt < 5000) {
    return;
  }

  lastMqttAttempt = millis();

  Serial.println("Connecting to MQTT broker...");

  if (mqttClient.connect("ESP32_EISS2")) {

    Serial.println("MQTT connected successfully!");

  } else {

    Serial.print("MQTT connection failed. State: ");
    Serial.println(mqttClient.state());
  }
}

// ---------------- MOTION DETECTION ----------------

void checkMotion() {

  if (!motionSensorReady) {
    return;
  }

  if (millis() - lastMotionCheck < MOTION_CHECK_INTERVAL) {
    return;
  }

  lastMotionCheck = millis();

  xyzFloat g = motionSensor.getGValues();

  if (havePreviousReading) {

    float dx = g.x - previousX;
    float dy = g.y - previousY;
    float dz = g.z - previousZ;

    float change = sqrt(dx * dx + dy * dy + dz * dz);

    if (change > MOTION_THRESHOLD) {
      lastMotionDetected = millis();
    }
  }

  previousX = g.x;
  previousY = g.y;
  previousZ = g.z;

  havePreviousReading = true;

  alertMode = (lastMotionDetected != 0 &&
               millis() - lastMotionDetected < ALERT_HOLD_TIME);
}
// ---------------- LED CONTROL ----------------

void updateLEDs() {

  if (alertMode) {

    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, HIGH);

  } else {

    digitalWrite(GREEN_LED, HIGH);
    digitalWrite(RED_LED, LOW);
  }
}

// ---------------- SENSOR READING AND MQTT ----------------

void publishSensorData() {

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  xyzFloat g = {0, 0, 0};

  if (motionSensorReady) {
    g = motionSensor.getGValues();
  }

  Serial.println("\n========== SENSOR READINGS ==========");

  if (!isnan(temperature) && !isnan(humidity)) {

    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" C");

    Serial.print("Humidity: ");
    Serial.print(humidity);
    Serial.println(" %");

  } else {

    Serial.println("DHT11 reading failed.");
  }

  Serial.print("Acceleration X: ");
  Serial.println(g.x);

  Serial.print("Acceleration Y: ");
  Serial.println(g.y);

  Serial.print("Acceleration Z: ");
  Serial.println(g.z);

  Serial.print("Adaptive Mode: ");
  Serial.println(alertMode ? "ALERT" : "NORMAL");

  unsigned long interval =
      alertMode ? ALERT_INTERVAL : NORMAL_INTERVAL;

  Serial.print("Sampling Interval: ");
  Serial.print(interval);
  Serial.println(" ms");

  // Publish only if readings are valid and MQTT is connected

  if (!isnan(temperature) &&
      !isnan(humidity) &&
      mqttClient.connected()) {

    char payload[300];

    snprintf(
      payload,
      sizeof(payload),
      "{\"temperature\":%.2f,"
      "\"humidity\":%.2f,"
      "\"accel_x\":%.3f,"
      "\"accel_y\":%.3f,"
      "\"accel_z\":%.3f,"
      "\"mode\":\"%s\","
      "\"sampling_interval\":%lu}",
      temperature,
      humidity,
      g.x,
      g.y,
      g.z,
      alertMode ? "ALERT" : "NORMAL",
      interval
    );

    if (mqttClient.publish(mqtt_topic, payload)) {

      Serial.println("MQTT DATA PUBLISHED SUCCESSFULLY!");

      Serial.println(payload);

    } else {

      Serial.println("MQTT publishing failed!");
    }

  } else {

    Serial.println("MQTT not connected or sensor reading invalid.");
  }

  Serial.println("=====================================");
}

// ---------------- SETUP ----------------

void setup() {

  Serial.begin(115200);

  delay(1000);

  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);

  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);

  Wire.begin(21, 22);

  dht.begin();

  // Initialize motion sensor

  if (motionSensor.init()) {

    motionSensorReady = true;

    Serial.println("Motion sensor initialized!");

  } else {

    Serial.println("Motion sensor unavailable!");
  }

  // Connect Wi-Fi

  connectWiFi();

  // Configure MQTT

  mqttClient.setServer(mqtt_server, mqtt_port);

  mqttClient.setBufferSize(384);

  Serial.println("Adaptive IoT sensing system started!");
}

// ---------------- MAIN LOOP ----------------

void loop() {

  if (WiFi.status() != WL_CONNECTED) {

    connectWiFi();
  }

  reconnectMQTT();

  mqttClient.loop();

  checkMotion();

  updateLEDs();

  unsigned long interval =
      alertMode ? ALERT_INTERVAL : NORMAL_INTERVAL;

  if (millis() - lastSensorRead >= interval) {

    lastSensorRead = millis();

    publishSensorData();
  }

  delay(10);
}
