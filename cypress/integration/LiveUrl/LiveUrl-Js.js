require('cypress-xpath')

it('881903', () => {
  cy.visit("https://www.881903.com/live/903")
  cy.intercept('GET', '/edge-aac/903hd/playlist.m3u8*').as('get-playlist')

  // ad
  cy.xpath('//*[@id="app"]/div[2]/div/div/div[1]/basebutton').click()

  // play
  // cy.get('#app > div.application--wrap > div.default-layout.app__layout.theme--light > div.default-layout__section.default-layout__body > div > div.player-section__wrapper.fullwidth.live-page__section > div > div.flex.player-section__player-box.grow > div > div.player-section__player > div > div.player__overlay > div', {timeout:30000}).click()

  // https://w03.881903.com/edge-aac/903hd/playlist.m3u8?r=sfqfyJbFaAwTFCuq&wmsAuthSign=c2VydmVyX3RpbWU9OC8zMC8yMDIxIDExOjIxOjI0IEFNJmhhc2hfdmFsdWU9Q3drMHZqV285bTZBdjFBVmpFWUE4Zz09JnZhbGlkbWludXRlcz0xNDQw

  cy.wait('@get-playlist', {timeout:30000}).should('have.property', 'response.statusCode', 200)
  cy.get('@get-playlist').then(console.log)

  cy.get('@get-playlist', {timeout:30000}).should(({request, response}) => {
     console.log("=================")
     console.log("=================")
     console.log("=================")
     console.log(request.url)
  })
})

