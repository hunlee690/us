// data.js
// View-only data with a static start date (5 Sep 2022)
window.SITE_DATA = {
  relationshipStart: "2022-09-05",
  nextMeetDate: "",
  versions: {
    // Load when password = "wuvu" or you toggle to "pinku"
    pinku: {
      heroHeadline: "Welcome,Pinku",
      yourName: "",
      herName: "",
      openingLine: "",
      surpriseMessage: "",
      playlistEmbed: { src: "https://open.spotify.com/embed/playlist/31SFaLiIHmjl29RF8dXuO0?utm_source=generator"},
      timeline: [
        // { date: "2024-01-01", title: "Title", caption: "Caption", img: "assets/cover.jpg" },
      ],
      gallery: [
        // { img: "assets/cover.jpg", caption: "Caption" },
      ],
      letters: [
        // { title: "A letter", body: "Body text..." },
      ],
      quiz: [
        // { q: "Our symbol?", options: ["Star", "Heart", "Moon"], answerIndex: 1 },
      ],
      bucket: [
        // { text: "Picnic under cherry blossoms", done: false },
      ]
    },

    // Load when password = "wuvu2" or you toggle to "hnnu"
    hnnu: {
      heroHeadline: "Welcom, Hnnu",
      yourName: "",
      herName: "",
      openingLine: "",
      surpriseMessage: "From 5 Sep 2022, every day with you has been a little sweeter. You’re my bacha and my home. Next time we meet, I’m bringing the tshirt to bring that pretty smile Roll on me. 🍯🐝💙",
      playlistEmbed: { src: "https://open.spotify.com/embed/playlist/31SFaLiIHmjl29RF8dXuO0?utm_source=generator"},
      timeline: [],
gallery: [
  { img: "assets/hillside.png",   caption: "Flower crown + hill breeze 🍃👑" },
  { img: "assets/look.png",       caption: "That look that melts me 🥹" },
  { img: "assets/her.png",        caption: "Her, glowing as always ✨" },
  { img: "assets/together.png",   caption: "Us, exactly where we belong ❤️" },
  { img: "assets/together1.png",  caption: "Laughing at nothing and everything 😂" },
  { img: "assets/together2.png",  caption: "Wind, whispers, and us 🌬️" },
  { img: "assets/cool selfi.png",caption: "Cool selfie. Cooler you 😎" } // rename file accordingly
],

      letters: [
{
    title: "my fav lyrics for you",
    body: `She got pretty eyes<br>
Oh my<br>
I just wanna make her mine<br>
All mine<br>
I don’t wanna waste her time<br>
No lie -<br>
She could do anything and I would still find a why we belong at night<br>
Let’s run away, far away from this place and grab<br>
Memories, different things, never looking back<br>
I love, every little thing you do<br>
The way you say my name and the way you move<br>
I know<br>
We can get through it<br>
Like your mind, your body, your movement<br>
Study you fine, I’m down to be a student<br>
Do anything just for your amusement<br>
Love when you laugh<br>
Especially when I do it<br>
You’ll never be last<br>
Watch and I’ll prove it<br>
My past, you can remove it<br>
You’re the one I’m choosing`
  }
],
// data.js → window.SITE_DATA.versions.hnnu.quiz
quiz: [
  {
    q: "When was our first kiss? 💋",
    options: ["14 Feb 2022 💘", "5 Sep 2021 🗓️", "1 Jan 2023 🎆","5 Sep 2022 📅"],
    answerIndex: 3
  },
  {
    q: "What is my favourite color? 🎨",
    options: ["Red ❤️","Blue 💙", "Black 🖤", "Green 💚"],
    answerIndex: 1
  },
  {
    q: "What is my pet name? 🐾",
    options: ["Sugar 🍬", "Honey 🍯", "Bunny 🐰", "dumbo😇"],
    answerIndex: 0
  },
  {
    q: "What is my favourite food? 🍽️",
    options: ["Pizza 🍕","Roll 🌯","Burger 🍔", "Pasta 🍝"],
    answerIndex: 1
  },
  {
    q: "What is my favourite outfit? 👗",
    options: ["Hoodie 🧥", "T-shirt & jeans 👕👖", "suit 🤵🏻", "Sweater 🧶"],
    answerIndex: 0
  }
],

      bucket: []
    }
  }
};
