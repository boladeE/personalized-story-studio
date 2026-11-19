/** What is wrong with the lock, field by field, in words for the sender. Empty when it is fine. */
export function lockProblems(question: string, answer: string): { question: string; answer: string } {
  const q = question.trim()
  const a = answer.trim()
  const gives = a.length >= 2 && q.toLowerCase().includes(a.toLowerCase())
  return {
    question: !q ? 'Add a question.' : q.length < 3 ? 'Make the question a little longer.' : '',
    answer: !a ? 'Add the answer that opens it.' : gives ? 'The question gives this answer away. Change one of them.' : '',
  }
}
