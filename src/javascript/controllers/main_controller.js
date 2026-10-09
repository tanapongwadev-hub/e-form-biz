import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    window.initMap = this.initMap;
  }

  initMap() {

    const locationFields = document.querySelectorAll('.location-field')

    Array.from(locationFields).forEach(locationField => {
      const mapElement = locationField.querySelector(".map")

      const center = { lat: 13.736717, lng: 100.523186 }
      const map = new google.maps.Map(mapElement, {
        center: center,
        zoom: 8,
      });

      const marker = new google.maps.Marker({
        map,
        anchorPoint: new google.maps.Point(0, -29),
      });

      const defaultBounds = {
        north: center.lat + 0.1,
        south: center.lat - 0.1,
        east: center.lng + 0.1,
        west: center.lng - 0.1,
      };
      const options = {
        bounds: defaultBounds,
        componentRestrictions: { country: "th" },
        fields: ["address_components", "geometry", "icon", "name"],
        strictBounds: false,
        types: ["establishment"],
      };
      const pacInput = mapElement.previousElementSibling
      const autocomplete = new google.maps.places.Autocomplete(pacInput, options);

      map.addListener('click', (e) => {
        map.setCenter(e.latLng);
        marker.setPosition(e.latLng);
        map.setZoom(10);
      })

      const lat = locationField.querySelector('.lat')
      const lng = locationField.querySelector('.lng')
      const confirmButton = locationField.querySelector('.confirm')
      confirmButton.addEventListener('click', (e) => {
        const position = marker.getPosition()
        lat.value = position.lat()
        lng.value = position.lng()
      })

      autocomplete.bindTo("bounds", map);
      autocomplete.addListener("place_changed", () => {
        marker.setVisible(false);

        const place = autocomplete.getPlace();

        if (!place.geometry || !place.geometry.location) {
          // User entered the name of a Place that was not suggested and
          // pressed the Enter key, or the Place Details request failed.
          window.alert("No details available for input: '" + place.name + "'");
          return;
        }

        // If the place has a geometry, then present it on a map.
        if (place.geometry.viewport) {
          map.fitBounds(place.geometry.viewport);
        } else {
          map.setCenter(place.geometry.location);
          map.setZoom(10);
        }

        marker.setPosition(place.geometry.location);
        marker.setVisible(true);
      });
    })
  }
}
