const frame = document.querySelector("#preview");
document.querySelector("#device").onchange = (e) => {
  frame.style.width = e.target.value;
};
document.querySelector("#refresh").onclick = () => {
  frame.src = "/?preview=1";
};
