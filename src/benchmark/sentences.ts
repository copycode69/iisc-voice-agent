export type BenchSentence = {
  id: string;
  lang: 'en' | 'hinglish';
  text: string;
  alt?: string;
};

export const BENCH_SENTENCES: BenchSentence[] = [
  { id: 'a1', lang: 'en', text: 'What is the weather forecast for Bangalore tomorrow?' },
  { id: 'a2', lang: 'en', text: 'Can you set a reminder for my meeting at 5 PM?' },
  { id: 'a3', lang: 'hinglish', text: 'Mujhe kal subah 7 baje ka alarm set karna hai.', alt: 'मुझे कल सुबह 7 बजे का alarm set करना है' },
  { id: 'a4', lang: 'hinglish', text: 'Aaj ka schedule kya hai, aur meri next meeting kab hai?', alt: 'आज का schedule क्या है और मेरी next meeting कब है' },
  { id: 'e1', lang: 'en', text: 'What is the temperature in Mysore today?' },
  { id: 'e2', lang: 'en', text: 'Remind me to call Rahul at 3 PM.' },
  { id: 'e3', lang: 'en', text: 'Set an alarm for 6:30 in the morning.' },
  { id: 'e4', lang: 'en', text: 'When is my next meeting?' },
  { id: 'e5', lang: 'en', text: 'Is it going to rain in Bangalore this evening?' },
  { id: 'e6', lang: 'en', text: 'Add a reminder for the lab seminar at 11 AM tomorrow.' },
  { id: 'e7', lang: 'en', text: 'What does my calendar look like today?' },
  { id: 'e8', lang: 'en', text: 'Please set a reminder for dinner at 8 PM.' },
  { id: 'h1', lang: 'hinglish', text: 'Bangalore ka kal ka mausam kaisa rahega?', alt: 'Bangalore का कल का मौसम कैसा रहेगा' },
  { id: 'h2', lang: 'hinglish', text: 'Mujhe Rahul ko 3 baje call karna yaad dilao.', alt: 'मुझे Rahul को 3 बजे call करना याद दिलाओ' },
  { id: 'h3', lang: 'hinglish', text: 'Subah 6:30 ka alarm laga do.', alt: 'सुबह 6:30 का alarm लगा दो' },
  { id: 'h4', lang: 'hinglish', text: 'Meri next meeting kab hai?', alt: 'मेरी next meeting कब है' },
  { id: 'h5', lang: 'hinglish', text: 'Aaj shaam Bangalore mein barish hogi kya?', alt: 'आज शाम Bangalore में बारिश होगी क्या' },
  { id: 'h6', lang: 'hinglish', text: 'Kal subah 11 baje lab seminar ka reminder set karo.', alt: 'कल सुबह 11 बजे lab seminar का reminder set करो' },
  { id: 'h7', lang: 'hinglish', text: 'Aaj mera din kaisa hai schedule mein?', alt: 'आज मेरा दिन कैसा है schedule में' },
  { id: 'h8', lang: 'hinglish', text: 'Dinner 8 PM ka reminder daal do.', alt: 'dinner 8 PM का reminder डाल दो' },
];
