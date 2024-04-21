const port = chrome.runtime.connect();

setUpListeners();

var context = "";
const HOME_URL = 'https://patents.google.com/';
var context_appeared = false; // will need to adjust frontend when going from home => results page

function setUpListeners() {
  console.log("url:", window.location.href);

  const searchBar = document.getElementById("searchInput");
  console.log("searchBar:", searchBar);

  const searchButton = document.getElementById('searchButton');
  console.log("searchButton:", searchButton);

  // Detect search: press enter in search bar, or click button

  searchBar.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { // OR click search button
      console.log('pressed enter');
      handleSearch();
    }
  }, false);

  searchButton.addEventListener('click', function () {
    console.log('pressed search');
    handleSearch();
    searchButton.click();
  });
}

function setUpContext() {
  console.log("setting up context");

  // text box to add context
  var contextDiv = '<div id="context" style="display: block; text-align: center; margin: 10px;"> <textarea id="context_box" rows="3" cols="50" placeholder="Paste context related to your search to help us disambiguate acronyms."></textarea> </div>';
  const parentElement = document.getElementsByClassName("style-scope search-results")[0];
  console.log("parentElement:", parentElement);
  parentElement.insertAdjacentHTML("afterend", contextDiv);

  context_appeared = true;
}

window.addEventListener("load", function () {
  setUpListeners();
  if (window.location.href != HOME_URL) {
    setUpContext();
  }
});

function resetDropdown(dropdown) {
  dropdown.value = dropdown.options[dropdown.selectedIndex];
}

async function handleSearch() {
  try {
    suggestedSearch = null;
    var query = document.getElementsByName("q")[0].value;

    // add context if given
    context_box = document.getElementById("context_box");
    console.log("context_box:", context_box);
    if (context_box.value) {
      context = context_box.value;
      query += ("; " + " " + query + " " + context);
    }

    console.log("waiting, query:", query);
    suggestedSearch = await modifyQuery(query); // should return list of strings and lists (alt definitions)
    console.log("got it!:", suggestedSearch);
    context = ""; // clear for next search
  }
  catch (error) {
    console.error("Error sending message:", error);
  }

  // clear any leftover elements
  var suggestElement = document.getElementById("suggestion");
  if (suggestElement) {
    console.log("removing suggestion");
    (suggestElement.parentNode).removeChild(suggestElement);
  }

  // make and display new element on page
  if (suggestedSearch) {
    var suggestDiv = '<div id="suggestion" style="display: block; text-align: center; font-size: 14px; margin: 15px; cursor: pointer;">Try searching for: <span style="color: #4682B4;">';

    for (const item of suggestedSearch) {
      console.log("item:", item);
      if (item == ";") {
        break;
      }
      else if (!Array.isArray(item)) {
        suggestDiv += item;
      }
      else {
        suggestDiv += ("(" + item[0] + " OR ");
        var dropdown = '<select id="' + item[0] + '">';
        var dropdown = '<select id="select_' + item[0] + '" onchange="resetDropdown(this)">';
        for (const subitem of item[1]) {
          dropdown += '<option value="' + subitem + '">' + subitem + '</option>';
        }
        dropdown += '</select>';
        suggestDiv += dropdown;
        suggestDiv += ")";
      }
    }
    suggestDiv += '</span></div>';

    // add new element
    const parentElement = document.getElementsByClassName("style-scope search-results")[0];
    console.log("parentElement:", parentElement)
    parentElement.insertAdjacentHTML("afterend", suggestDiv);
    suggestElement = document.getElementById("suggestion");
    suggestElement.addEventListener('click', searchAgain);
  }

  // set everything up for results page
  console.log("124, context_appeared:", context_appeared);
  if (context_appeared == false) {
    setUpListeners();
    setUpContext();
  }
}

function searchAgain() {
  var newQuery = "";
  for (const item of suggestedSearch) {
    if (item == ";") {
      break;
    }
    else if (!Array.isArray(item)) {
      newQuery += item;
    }
    else {
      newQuery += ("(" + item[0] + " OR ");
      var dropdown = document.getElementById("select_" + item[0]);
      newQuery += dropdown.value;
      newQuery += ")";
    }
  }

  document.getElementsByName("q")[0].value = newQuery;
}

// send full text (query + context) to MadDog, get disambiguations
async function modifyQuery(data, use_zeroshot = true) {
  try {
    const response = await fetch('http://127.0.0.1:5001/modify_query', {
      method: 'POST',
      body: JSON.stringify({ text: data, use_zeroshot: use_zeroshot }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error:", error);
  }
  // return [['DSLR', ['digital single lens reflex', 'double straight leg raise', 'digital single lens reflective']], ' ', 'camera'];
}