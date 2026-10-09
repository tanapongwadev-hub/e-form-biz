// Entry point for the build script in your package.json
import "@hotwired/turbo-rails"
import "./controllers"
import * as bootstrap from "bootstrap"
import "dropzone"
import "select2"
import "trix"
import "@rails/actiontext"

Trix.config.blockAttributes.heading1 = {
  tagName: "h1",
  terminal: true,
  breakOnReturn: true,
  group: false
};

Trix.config.blockAttributes.heading2 = {
  tagName: "h2",
  terminal: true,
  breakOnReturn: true,
  group: false
};

Trix.config.blockAttributes.heading3 = {
  tagName: "h3",
  terminal: true,
  breakOnReturn: true,
  group: false
};

$(document).ready(() => {
  initDateSelect()
  initHintTooltip()
})

document.addEventListener('cable-ready:after-morph', event => {
  initDateSelect()
  initHintTooltip()
})

const initDateSelect = () => {
  $("select[name*='(1i)']").each((_, element) => {
    Array.from(element.querySelectorAll('option')).forEach((option) => {
      option.text = +option.text + 543
    })
  })
}

const initHintTooltip = () => {
  $('.hint-tooltip').each((_, element) => {
    const hintElement = $(element).siblings(".hint-text")

    if (hintElement) {
      const hintText = hintElement.text()
      if (!hintText) {
        $(element).remove()
      } else {
        $(element).attr("data-bs-title", hintText)
        element.classList.remove('d-none')
        hintElement.remove()
        new bootstrap.Tooltip(element)
      }
    }
  })
}

window.onlyNumber = (e) => {
  var key = window.event ? e.keyCode : e.which;
  if (e.keyCode === 8 || e.keyCode === 46 || e.keyCode === 45) {
    return true;
  } else if (key < 48 || (key > 57 && key < 92) || key > 105) {
    return false;
  } else {
    return true;
  }
}

window.onlyNumberNoDecimal = (event) => {
  const key = event.key;
  const regex = /^[0-9]$/; // อนุญาตเฉพาะตัวเลข 0-9
  if (!regex.test(key)) {
    event.preventDefault(); // ป้องกันไม่ให้พิมพ์ตัวอักษรที่ไม่ผ่านเงื่อนไข
  }
}

window.formatNumberInput = (event) => {
  const input = event.target;
  let value = input.value.replace(/[^0-9]/g, ""); // เอาเฉพาะตัวเลขออกมา
  value = new Intl.NumberFormat("en-US").format(value); // ฟอร์แมตตัวเลข
  input.value = value; // อัปเดตค่าที่ฟอร์แมตแล้วกลับไปใน input
}

window.thOnly = (e) => {
  let pattern = /[\u0E00-\u0E7F0-9\s\/]/i;
  let result = e.key.match(pattern);

  if (result) {
    return true
  } else {
    return false
  }
}

window.enOnly = (e) => {
  let pattern = /[a-zA-Z0-9\-\s\/]/i;
  let result = e.key.match(pattern);

  if (result) {
    return true
  } else {
    return false
  }
}

const isNumericInput = (event) => {
	const key = event.keyCode;
	return ((key >= 48 && key <= 57) || // Allow number line
		(key >= 96 && key <= 105) // Allow number pad
	);
};


const isModifierKey = (event) => {
	const key = event.keyCode;
	return (event.shiftKey === true || key === 35 || key === 36) || // Allow Shift, Home, End
		(key === 8 || key === 9 || key === 13 || key === 46) || // Allow Backspace, Tab, Enter, Delete
		(key > 36 && key < 41) || // Allow left, up, right, down
		(
			// Allow Ctrl/Command + A,C,V,X,Z
			(event.ctrlKey === true || event.metaKey === true) &&
			(key === 65 || key === 67 || key === 86 || key === 88 || key === 90)
		)
};

window.enforceFormat = (event) => {
	// Input must be of a valid number format or a modifier key, and not longer than ten digits
  const dashKeyCode = 189
	if(event.keyCode != dashKeyCode && !onlyNumber(event) && !isModifierKey(event)) {
		event.preventDefault();
	}
};

window.formatToPhone = (event) => {
	// if(isModifierKey(event)) {return;}

	// I am lazy and don't like to type things more than once
	const target = event.target;
	const input = event.target.value.replace(/\D/g,'').substring(0, 10); // First ten digits of input only

  if (input.length == 10) {
    const zip = input.substring(0, 2);
    const middle = input.substring(2, 6);
    const last = input.substring(6, 10);
    target.value = `${zip} ${middle} ${last}`;
  } else if (input.length == 9) {
    // 2 รูปแบบ ของเบอร์ โทรศัพท์ สามารถ ทำให้รองรับ เบอร์ที่เป็น โทรศัพท์ บ้าน  0-2354-7484       0-3242-5338
    const zip = input.substring(0, 1);
    const middle = input.substring(1, 5);
    const last = input.substring(5, 9);
    target.value = `${zip} ${middle} ${last}`;
  }
};


window.formatToNationalId = (event) => {
	if(isModifierKey(event)) {return;}

	// I am lazy and don't like to type things more than once
	const target = event.target
	const input = event.target.value.replace(/\D/g,'').substring(0, 13); // First ten digits of input only

  // console.log(input)
  // 1 1001 01245 29 9
	const section1 = input.substring(0, 1);
	const section2 = input.substring(1, 5);
	const section3 = input.substring(5, 10);
	const section4 = input.substring(10, 12);
	const section5 = input.substring(12, 14);

	if (input.length > 11) {
    target.value = [section1, section2, section3, section4, section5].join(' ');
  } else if (input.length > 9) {
    target.value = [section1, section2, section3, section4].join(' ');
  } else if (input.length > 4) {
    target.value = [section1, section2, section3].join(' ');
  } else if (input.length > 1) {
    target.value = [section1, section2].join(' ');
  } else {
    target.value = input
  }
};
