$(window).scroll(function() {
    var scroll = $(window).scrollTop();
    if (scroll >= 200) {
        $(".navbar").addClass("navBg");
    } else {
        $(".navbar").removeClass("navBg");
    }
});

$('.fancybox').click(function(e) {
    e.preventDefault();
    $
})

$('.fancybox').click(function(e) {

    $('body, html').animate({

        scrollTop: $('.about, .join').offset().top - $('.navbar').innerHeight()
    }, 500);

});


$(document).ready(function() {
    $(".navbar-nav .nav-item .nav-link, .dropdown-item").click(function(e) {
        //$(this).parent().addClass("act").siblings().removeClass("act");
        $("body, html").animate({
                // scrollTop = divId.offset().top
                scrollTop: $("#" + $(this).data("target")).offset().top

            },
            800
        );
    });

    $(".navbar-nav .nav-item .nav-link, .dropdown-item").click(function() {
        $(".navbar-collapse").removeClass("show");
    })
})


//form validation 
$(document).ready(function(){

    'use strict ';

    var userEror = true,
        mailError = true,
        msgError = true;
 

    $('.userName').blur(function(){

        if( $(this).val().length <= 3 ){


            $(this).css('border', '1px solid #f00')

            $(this).parent().find('.my-alert').fadeIn(200)

            userEror = true;

        }else{
            $(this).css('border', '1px solid #080')

            $(this).parent().find('.my-alert').fadeOut(200);
            userEror = false;

        }
    });

    $('.myMail').blur(function(){

        if( $(this).val().length == '' ){


            $(this).css('border', '1px solid #f00')

            $(this).parent().find('.my-alert').fadeIn(200)
            mailError = true;

        }else{
            $(this).css('border', '1px solid #080')
            
            $(this).parent().find('.my-alert').fadeOut(200)
            mailError = false;
        }
    })

    $('.myMsg').blur(function(){

        if( $(this).val().length < 10 ){


            $(this).css('border', '1px solid #f00')

            $(this).parent().find('.my-alert').fadeIn(200);
            msgError = true

        }else{
            $(this).css('border', '1px solid #080')
            
            $(this).parent().find('.my-alert').fadeOut(200);
            msgError = false 
        }
    })


    $('.myForm').submit (function(e){
        if(userEror === true || mailError === true || msgError === true ){
            e.preventDefault();

            $('.myMsg , .myMail ,.userName ').blur()
        }
    })
})