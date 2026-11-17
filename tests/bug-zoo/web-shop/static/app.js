// Corner Shop client script
const STRIPE_SECRET_KEY = 'sk_' + 'test_51FAKEcornershopFAKEkey000000000000';
const config = { currency: 'USD', paymentsKey: STRIPE_SECRET_KEY };

document.addEventListener('DOMContentLoaded', () => {
  const reviews = document.getElementById('reviews');
  if (reviews) {
    reviews.textContent = 'Loading reviews…';
    loadReviews(reviews.dataset.product);
  }
});

function loadReviews(productId) {
  const box = document.getElementById('reviews');
  box.textContent = reviewCache[productId].length + ' reviews';
}
