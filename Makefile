.PHONY: help install build build-devices build-runtime build-communication build-services build-dashboard-client build-dashboard run-devices run-runtime run-services run-dashboard demo clean stop-demo

# Default target: display help
help:
	@echo "Available commands:"
	@echo "  make install         - Install dependencies for all workspaces"
	@echo "  make build           - Build all workspaces (devices, runtime, communication, services, dashboard)"
	@echo "  make build-devices   - Build the devices workspace"
	@echo "  make build-runtime   - Build the runtime workspace"
	@echo "  make build-services  - Build the services workspace"
	@echo "  make build-dashboard - Build the dashboard client & server workspaces"
	@echo "  make run-devices     - Build and run the devices workspace"
	@echo "  make run-runtime     - Build and run the runtime workspace"
	@echo "  make run-services    - Build and run the services workspace (REST API + internal subscriber)"
	@echo "  make run-dashboard   - Build and run the dashboard server"
	@echo "  make demo            - Launch the full end-to-end demo with dashboard"
	@echo "  make clean           - Remove build artifacts (dist folders)"

install:
	npm install

build-devices:
	npm run build -w devices

build-runtime:
	npm run build -w runtime 

build-communication:
	npm run build -w communication

build-services: build-communication
	npm run build -w services

build-dashboard-client:
	npm run build -w @chariot/dashboard-client

build-dashboard: build-dashboard-client
	npm run build -w @chariot/dashboard

build: build-devices build-runtime build-communication build-services build-dashboard

run-devices: build-devices
	npm run start -w devices

run-runtime-house1: build-runtime
	START_BROKER=true SITE_ID=house-1 SITE_TYPE=home ZONE_ID=quartier-nord DEVICE_IDS=matter-temp-01,zigbee-temp-01,zigbee-energy-01 TELEMETRY_ENABLED=true npm run start -w runtime

run-runtime-house2: build-runtime
	START_BROKER=false SITE_ID=house-2 SITE_TYPE=home ZONE_ID=quartier-nord DEVICE_IDS=thread-temp-01,thread-energy-01 TELEMETRY_ENABLED=true npm run start -w runtime
run-runtime-house3: build-runtime
	START_BROKER=false SITE_ID=house-3 SITE_TYPE=home ZONE_ID=quartier-nord DEVICE_IDS=matter-temp-03,zigbee-temp-03,zigbee-energy-03 TELEMETRY_ENABLED=true npm run start -w runtime

run-runtime-house4: build-runtime
	START_BROKER=false SITE_ID=house-4 SITE_TYPE=home ZONE_ID=quartier-nord DEVICE_IDS=matter-temp-04,zigbee-temp-04,zigbee-energy-04 TELEMETRY_ENABLED=true npm run start -w runtime

run-runtime-house5: build-runtime
	START_BROKER=false SITE_ID=house-5 SITE_TYPE=home ZONE_ID=quartier-nord DEVICE_IDS=matter-temp-05,zigbee-temp-05,zigbee-energy-05 TELEMETRY_ENABLED=true npm run start -w runtime

run-runtime-building1: build-runtime
	START_BROKER=false SITE_ID=building-1 SITE_TYPE=building ZONE_ID=quartier-nord DEVICE_IDS=zigbee-occupancy-01,zigbee-security-01,thread-airquality-01 TELEMETRY_ENABLED=true npm run start -w runtime

run-runtime-building2: build-runtime
	START_BROKER=false SITE_ID=building-2 SITE_TYPE=building ZONE_ID=quartier-nord DEVICE_IDS=zigbee-occupancy-02,zigbee-security-02,thread-airquality-02 TELEMETRY_ENABLED=true npm run start -w runtime

run-runtime-building3: build-runtime
	START_BROKER=false SITE_ID=building-3 SITE_TYPE=building ZONE_ID=quartier-nord DEVICE_IDS=zigbee-occupancy-03,zigbee-security-03,thread-airquality-03 TELEMETRY_ENABLED=true npm run start -w runtime

run-runtime-building4: build-runtime
	START_BROKER=false SITE_ID=building-4 SITE_TYPE=building ZONE_ID=quartier-nord DEVICE_IDS=zigbee-occupancy-04,zigbee-security-04,thread-airquality-04 TELEMETRY_ENABLED=true npm run start -w runtime

run-services: build-services
	TELEMETRY_ENABLED=true npm run start -w services

run-dashboard: build-dashboard
	TELEMETRY_ENABLED=true npm run start -w @chariot/dashboard

demo: build
	rm -rf ~/.matter
	npx -y concurrently -n "Devices,Runtime1,Runtime2,Building1,Building2,Building3,Building4,House3,House4,House5,Services,Dashboard" -c "green,blue,cyan,yellow,red,magenta,blue,gray,magenta,cyan,gray,green" \
		"make run-devices" \
		"sleep 8 && make run-runtime-house1" \
		"sleep 10 && make run-runtime-house2" \
		"sleep 12 && make run-runtime-building1" \
		"sleep 13 && make run-runtime-building2" \
		"sleep 14 && make run-runtime-building3" \
		"sleep 15 && make run-runtime-building4" \
		"sleep 17 && make run-services" \
		"sleep 22 && make run-dashboard"

stop-demo:
	@echo "Stopping Chariot demo processes..."
	@pkill -f "run-devices" || true
	@pkill -f "run-runtime" || true
	@pkill -f "run-services" || true
	@pkill -f "run-dashboard" || true
	@pkill -f "dist/index.js --device" || true
	@pkill -f "dist/index.js --runtime" || true
	@pkill -f "services/dist/index.js" || true
	@pkill -f "node.*services" || true
	@pkill -f "runtime/dist/listen.js" || true
	@pkill -f "dashboard/dist/index.js" || true
	@sleep 1


clean:
	rm -rf devices/dist runtime/dist communication/dist services/dist dashboard/dist dashboard-client/dist



