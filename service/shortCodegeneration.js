import crypto from "node:crypto";

//the cryptographic generator does not provide enough entropyu
export function shortcode(length = 6) {
  //define a set of chars
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  //populate the string
  let result = "";
  //populate the array of length 6  with random number
  const randomArray = new Uint8Array(length);

  //randomize
  crypto.getRandomValues(randomArray);

  //loop through the array and create a random string by populating result
  //iterate six times
  //the reusult is the position of the chars string
  randomArray.forEach((number) => {
    result += chars[number % chars.length];
  });
  return result;
}
