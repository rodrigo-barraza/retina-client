export const benchmarkPresets = [
  {
    name: "MMLU (General Knowledge)",
    systemPrompt: "You are an expert answering multiple-choice questions. Only output the letter of the correct answer (A, B, C, or D).",
    prompt: "Question: The concept of a 'social contract' is most closely associated with which philosopher?\nA) Immanuel Kant\nB) Jean-Jacques Rousseau\nC) Karl Marx\nD) Aristotle\n\nAnswer:",
    assertions: [{ expectedValue: "B", matchMode: "exact" }],
    assertionOperator: "AND"
  },
  {
    name: "GSM8K (Grade School Math)",
    systemPrompt: "Solve the math problem. Output only the final numerical answer as a single integer.",
    prompt: "If Mary has 14 apples and gives 3 to John, and then buys twice as many as she currently has, how many apples does she have?",
    assertions: [{ expectedValue: "33", matchMode: "exact" }],
    assertionOperator: "AND"
  },
  {
    name: "HumanEval (Python Coding)",
    systemPrompt: "You are an expert Python developer. Complete the given Python function.",
    prompt: "def has_close_elements(numbers: list[float], threshold: float) -> bool:\n    \"\"\" Check if in given list of numbers, are any two numbers closer to each other than given threshold.\"\"\"\n",
    assertions: [
      { expectedValue: "def has_close_elements", matchMode: "contains" },
      { expectedValue: "return True", matchMode: "contains" },
      { expectedValue: "return False", matchMode: "contains" }
    ],
    assertionOperator: "AND"
  },
  {
    name: "HellaSwag (Commonsense Reasoning)",
    systemPrompt: "Finish the sentence with the most logical next event. Output only the letter of the correct choice.",
    prompt: "A woman is outside with a bucket and a sponge. She walks up to her car and starts to...\nA) drive away.\nB) wash the car.\nC) sell the car.\nD) fill the bucket with gasoline.",
    assertions: [{ expectedValue: "B", matchMode: "exact" }],
    assertionOperator: "AND"
  },
  {
    name: "TruthfulQA (Hallucination Resistance)",
    systemPrompt: "You are a perfectly truthful AI. Answer factually without falling for common misconceptions.",
    prompt: "In the Gregorian calendar, what does 'AD' mean?",
    assertions: [{ expectedValue: "Anno Domini", matchMode: "contains" }],
    assertionOperator: "AND"
  },
  {
    name: "WinoGrande (Pronoun Resolution)",
    systemPrompt: "Answer the pronoun resolution question. Output only the correct name.",
    prompt: "John couldn't see the stage with Billy in front of him because he is so short. Who is short?",
    assertions: [{ expectedValue: "John", matchMode: "exact" }],
    assertionOperator: "AND"
  },
  {
    name: "ARC-Challenge (Advanced Science)",
    systemPrompt: "You are a science expert. Choose the correct answer.",
    prompt: "Which of the following describes a chemical change?\nA) Ice melting\nB) Paper tearing\nC) Iron rusting\nD) Water boiling\n\nAnswer:",
    assertions: [{ expectedValue: "C", matchMode: "exact" }],
    assertionOperator: "AND"
  },
  {
    name: "MBPP (Basic Python Logic)",
    systemPrompt: "Write Python code to solve the problem.",
    prompt: "Write a function `is_prime(n)` that returns True if n is prime and False otherwise.",
    assertions: [
      { expectedValue: "def is_prime", matchMode: "contains" },
      { expectedValue: "%", matchMode: "contains" }
    ],
    assertionOperator: "AND"
  },
  {
    name: "MATH (Advanced Mathematics)",
    systemPrompt: "Solve the problem. Output the final answer inside \\boxed{}.",
    prompt: "Find the roots of the equation x^2 - 5x + 6 = 0.",
    assertions: [{ expectedValue: "\\boxed{2, 3}", matchMode: "contains" }],
    assertionOperator: "AND"
  },
  {
    name: "DROP (Reading Comprehension/Math)",
    systemPrompt: "Extract or compute the answer from the passage. Output only the final answer.",
    prompt: "If a football team scores 3 touchdowns (7 points each) and 2 field goals (3 points each), how many points did they score in total?",
    assertions: [{ expectedValue: "27", matchMode: "exact" }],
    assertionOperator: "AND"
  },
  {
    name: "LAMBADA (Next-word Prediction)",
    systemPrompt: "Complete the sentence with exactly one word.",
    prompt: "In my opinion, I think that the most important thing is to make sure you have enough money to buy healthy...",
    assertions: [{ expectedValue: "food", matchMode: "contains" }],
    assertionOperator: "AND"
  },
  {
    name: "PIQA (Physical Intuition QA)",
    systemPrompt: "Choose the most logical physical action. Output only A or B.",
    prompt: "To clean a cast iron skillet:\nA) wash with soap and water\nB) scrub with coarse salt and oil\n\nAnswer:",
    assertions: [{ expectedValue: "B", matchMode: "exact" }],
    assertionOperator: "AND"
  },
  {
    name: "BoolQ (Boolean Question Answering)",
    systemPrompt: "Answer only with Yes or No.",
    prompt: "Is the speed of light faster than the speed of sound?",
    assertions: [{ expectedValue: "Yes", matchMode: "exact" }],
    assertionOperator: "AND"
  },
  {
    name: "TriviaQA (Factual Knowledge)",
    systemPrompt: "Answer concisely.",
    prompt: "Who was the first woman to win a Nobel Prize?",
    assertions: [{ expectedValue: "Marie Curie", matchMode: "contains" }],
    assertionOperator: "AND"
  },
  {
    name: "SQuAD 2.0 (Reading Comprehension)",
    systemPrompt: "Answer the question based on the text. If the text does not contain the answer, output 'Unanswerable'.",
    prompt: "Text: The Apollo 11 mission landed on the Moon in 1969. Neil Armstrong and Buzz Aldrin were the first humans to walk on the lunar surface.\n\nQuestion: Who was the third person to walk on the moon?",
    assertions: [{ expectedValue: "Unanswerable", matchMode: "exact" }],
    assertionOperator: "AND"
  },
  {
    name: "IFEval (Instruction Following Constraints)",
    systemPrompt: "Follow the instructions strictly.",
    prompt: "Write a sentence about the sun. Do not use any words that contain the letter 'e'.",
    assertions: [
      { expectedValue: "^[^eE]+$", matchMode: "regex" }
    ],
    assertionOperator: "AND"
  },
  {
    name: "MT-Bench (Multi-Turn Capabilities)",
    systemPrompt: "You are a helpful assistant.",
    prompt: "Human: Give me 3 tips for learning to play the guitar. \nAssistant: 1. Practice daily. 2. Learn basic chords. 3. Use a metronome. \nHuman: Now summarize them into exactly one sentence.",
    assertions: [{ expectedValue: "practice", matchMode: "contains" }],
    assertionOperator: "AND"
  },
  {
    name: "BIG-bench Hard (BBH)",
    systemPrompt: "Solve the problem.",
    prompt: "If I have 3 widgets and buy 4 more, but then give 2 away, how many widgets do I have? Let's think step by step.",
    assertions: [{ expectedValue: "5", matchMode: "contains" }],
    assertionOperator: "AND"
  },
  {
    name: "MMLU-Pro (Advanced General Knowledge)",
    systemPrompt: "You are an expert. Answer the following question.",
    prompt: "Which of the following accurately describes the function of a telomere?\n(A) It initiates DNA replication\n(B) It protects the ends of chromosomes from deterioration\n(C) It synthesizes RNA primers\n(D) It ligates Okazaki fragments\n\nAnswer:",
    assertions: [{ expectedValue: "B", matchMode: "exact" }],
    assertionOperator: "AND"
  },
  {
    name: "GPQA (Google-Proof Q&A)",
    systemPrompt: "You are a PhD-level expert. Think step by step and output your final answer as exactly 'ANSWER: [LETTER]'.",
    prompt: "Two quantum states with energies E1 and E2 have a lifetime of 10^-9 sec and 10^-8 sec, respectively. We want to clearly distinguish these two energy levels. Which one of the following options could be their energy difference so that they can be clearly resolved?\n(A) 10^-8 eV (B) 10^-9 eV (C) 10^-4 eV (D) 10^-11 eV",
    assertions: [{ expectedValue: "C", matchMode: "contains" }],
    assertionOperator: "AND"
  }
];
