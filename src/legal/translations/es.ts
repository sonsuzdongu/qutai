import type { LegalTranslation } from '../documents';

/**
 * Spanish translation of the privacy policy and terms of both builds, machine-translated from English on 20 Nov 2026
 * and not yet reviewed by a native speaker or a lawyer. The sections added on 21 Nov 2026 (protective clauses) are
 * machine-translated too and not reviewed. The English version prevails.
 */

const CONTACTS_BODY =
  'Si usted lo permite, el asistente puede encontrar en los contactos de su teléfono a una persona que usted nombre ' +
  '(por ejemplo, «llama a Carlos»). Qutai busca solo los nombres que usted mismo dice, en su teléfono; su libreta de ' +
  'direcciones nunca se sube ni se enumera. El servicio de IA recibe solo los nombres que coinciden y los tipos de ' +
  'número o dirección que tiene cada uno (como «móvil» o «correo del trabajo»), nunca los números ni las direcciones ' +
  'en sí: usted los ve en el botón o en el borrador, y es usted quien llama o envía. Los números y direcciones de ' +
  'sus contactos no se guardan con sus conversaciones, la memoria del asistente ni sus copias de seguridad. Los ' +
  'contactos no se usan en conversaciones con pestañas de incógnito. Puede cambiar el permiso en Configuración.';

const PASSWORDS_BODY =
  'Qutai no permite que la memoria del asistente guarde contraseñas, números de tarjeta, códigos de seguridad de ' +
  'tarjeta, fechas de vencimiento de tarjeta, códigos de un solo uso ni números de cuenta bancaria (IBAN). Los ' +
  'números de documento de identidad y de pasaporte solo pueden guardarse en identidad o viajes; se ocultan al ' +
  'servicio de IA, que solo ve una etiqueta, y Qutai escribe el número en el sitio por sí mismo después de que usted ' +
  'lo confirme. Antes de que el asistente introduzca por primera vez en un sitio sus datos personales guardados, ' +
  'Qutai se lo pregunta (puede cambiar esto para cada sitio). También puede exigir su confirmación antes de cada ' +
  'acción y bloquear el asistente en los sitios que usted elija.';

const BULLET_WEBSITES =
  '• Los sitios web que visita reciben lo que cualquier navegador les envía y los datos que usted le pide al ' +
  'asistente que escriba en ellos (como su nombre o su dirección en un formulario).\n';

const BULLETS_COMMON =
  '• Si las sugerencias de búsqueda están activadas, lo que escribe en la barra de direcciones se envía a su motor ' +
  'de búsqueda (nunca desde pestañas de incógnito).\n' +
  '• Si toca «Usar mi ubicación» en la configuración inicial, su posición aproximada se envía al servicio de ' +
  'direcciones del teléfono (el de Apple en un iPhone; en Android, normalmente el de Google) para encontrar el ' +
  'nombre del lugar. Solo se guarda el nombre del lugar.\n' +
  '• Si le habla al asistente y el teléfono no puede reconocer ese idioma en el propio dispositivo, el audio va al ' +
  'servicio de voz del teléfono (el de Apple o el de Google), solo después de que usted lo haya aceptado una vez en ' +
  'Qutai y nunca en conversaciones de incógnito. Qutai y el servicio de IA reciben solo el texto.\n' +
  '• Cuando el asistente le muestra opciones como tarjetas, sus imágenes se cargan desde los sitios que las muestran ' +
  '(o desde los servidores de imágenes de esos sitios), sin sus cookies, también para las opciones que usted no ' +
  'abre; en conversaciones de incógnito, solo cuando toca «Mostrar imágenes».\n' +
  '• Mientras «Bloquear anuncios y rastreadores» está activado, las listas de filtros que usted eligió se descargan ' +
  'de sus editores (como EasyList y AdGuard) y se actualizan cada pocos días. Estas solicitudes no contienen nada ' +
  'sobre su navegación.';

const ENGLISH_PREVAILS = ' Si esta traducción y la versión en inglés difieren, prevalece la versión en inglés.';

const POLICY_CHANGES =
  'Si esta política cambia, Qutai le muestra la nueva versión y le pide que la acepte antes de continuar.' +
  ENGLISH_PREVAILS;

const TERMS_CHANGES =
  'Si estas condiciones cambian, Qutai le muestra la nueva versión y le pide que la acepte antes de continuar.' +
  ENGLISH_PREVAILS;

const TERMS_INTRO = 'Al usar Qutai, usted acepta estas condiciones. Léalas junto con la Política de privacidad.';

const BLOCKING_HEADING = 'Bloqueo, estilos de página, scripts y apps';

const BLOCKING_PRIVACY_START =
  'El bloqueo de anuncios, rastreadores y anuncios de vídeo se hace en su teléfono: las listas de filtros se ' +
  'descargan en el teléfono (véase más arriba) y las solicitudes de cada página se comprueban allí con ellas, así ' +
  'que nada sobre las páginas que visita llega a los editores de las listas';

const BLOCKING_PRIVACY_COOKIES =
  '. «Ocultar avisos de cookies» solo oculta los avisos; nunca acepta ni rechaza cookies por usted. Sus propias ' +
  'reglas, estilos guardados y scripts guardados se almacenan solo en el teléfono y, si hace una, ';

const BLOCKING_PRIVACY_AI =
  'Cuando el asistente escribe un estilo o un script, el servicio de IA recibe su solicitud y el contenido de la ' +
  'página que necesita, como con cualquier pregunta, y también recibe el resultado de un script que usted aprobó; ' +
  'Qutai rechaza los scripts que tocan las cookies, y el resultado de un script nunca se guarda en la memoria del ' +
  'asistente, en las copias de seguridad ni en el historial de acciones. Las apps dentro de Qutai se almacenan ' +
  'solo en el teléfono y, si las incluye, ';

const BLOCKING_PRIVACY_APPS =
  'Cuando le pide a Qutai que cree o corrija una app, su código y sus mensajes de error van al servicio de IA; lo ' +
  'que usted guarda en una app, nunca. Las apps no pueden acceder a internet ni ver sitios web ni sus cookies.';

const BLOCKING_PRIVACY_OPEN_SOURCE =
  BLOCKING_PRIVACY_START +
  BLOCKING_PRIVACY_COOKIES +
  'en su archivo de copia de seguridad, cifrado con su contraseña. ' +
  BLOCKING_PRIVACY_AI +
  'en su archivo de copia de seguridad. ' +
  BLOCKING_PRIVACY_APPS;

const BLOCKING_PRIVACY_PRO =
  BLOCKING_PRIVACY_START +
  ' ni a Qutai' +
  BLOCKING_PRIVACY_COOKIES +
  'en sus copias de seguridad (el archivo que usted exporta o la copia de seguridad en su cuenta de Qutai), ' +
  'cifradas con su contraseña. ' +
  BLOCKING_PRIVACY_AI +
  'en sus copias de seguridad. ' +
  BLOCKING_PRIVACY_APPS;

const NOT_A_PARTY = 'Qutai no es parte de ese acuerdo y no puede reembolsar esos costos.';

const BROWSER_BODY =
  'Qutai muestra sitios web que gestionan otras personas. No controlamos, verificamos ni respaldamos los sitios ' +
  'web, su contenido ni los productos y servicios que ofrecen, y no somos responsables de ellos. Los sitios web y ' +
  'su contenido pertenecen a sus propietarios. Cuando usa un sitio web, se aplican sus propias condiciones y la ' +
  'ley, y usted es responsable de cumplirlas. Los enlaces, los resultados de búsqueda y las sugerencias, incluidas ' +
  'las del asistente, no son recomendaciones nuestras.';

const ASSISTANT_BODY =
  'El asistente puede leer páginas, hacer clic, escribir, rellenar formularios y preparar publicaciones, mensajes ' +
  'y pedidos cuando usted se lo pide. Antes de publicar o enviar texto en un sitio, Qutai le pide su aprobación. ' +
  'Completar un pago está desactivado hasta que usted active «Permitir que el asistente complete pagos» en ' +
  'Configuración › Asistente; incluso entonces, cada pago necesita su aprobación en el propio cuadro de diálogo de ' +
  'Qutai, que muestra el total. La IA puede cometer errores: verifique lo que aprueba y revise las compras, ' +
  'reservas, pagos, publicaciones, mensajes, eliminaciones, cambios en cuentas y otras acciones importantes antes ' +
  'de que se completen. Usted es responsable de las acciones que pide o aprueba, como si las hubiera realizado ' +
  'usted mismo. Sus compras y demás tratos con sitios web, vendedores y otras personas son entre usted y ellos: ' +
  'Qutai no es parte de ellos y nunca gestiona sus pagos a ellos. Puede exigir confirmación antes de cada acción ' +
  'en Configuración y bloquear el asistente en los sitios que usted elija.';

const AI_ANSWERS_BODY =
  'Las respuestas, los resúmenes, las traducciones y cualquier otra cosa que escriba la IA pueden ser erróneos, ' +
  'incompletos o estar desactualizados. No son asesoramiento profesional, por ejemplo médico, jurídico, financiero ' +
  'o fiscal: para esos asuntos, consulte a un profesional cualificado. Verifique la información importante antes ' +
  'de confiar en ella.';

const BLOCKING_TERMS_BODY =
  'Bloquear anuncios y rastreadores, ocultar avisos de cookies y bloquear anuncios de vídeo son funciones que usted ' +
  'elige: puede desactivar cada una en Configuración › Privacidad y seguridad, y desactivar el bloqueo para un ' +
  'sitio en el panel de ese sitio («Bloquear anuncios de vídeo» está desactivado hasta que usted lo active). El ' +
  'bloqueo solo funciona en las páginas que abre en su teléfono; no cambia los sitios web en sí. Las listas de ' +
  'filtros las elaboran terceros con sus propias licencias (por ejemplo, EasyList con GPLv3 o CC BY-SA 3.0, y ' +
  'AdGuard con GPLv3); su teléfono las descarga de sus editores, y Configuración muestra la página principal y la ' +
  'licencia de cada lista. No garantizamos lo que se bloquea o no: las listas pueden bloquear demasiado o ' +
  'demasiado poco, y un sitio puede dejar de funcionar, mostrar menos o pedirle que desactive el bloqueo. Usar el ' +
  'bloqueo en un sitio es decisión suya, y las condiciones de ese sitio se aplican a su visita.';

const STYLES_BODY =
  'Puede pedirle al asistente que cambie el aspecto de una página (un estilo) o que ejecute un script en una ' +
  'página, guardarlos para un sitio, y escribirlos, editarlos, importarlos y exportarlos usted mismo. Los scripts ' +
  'están desactivados hasta que usted los active en Configuración › Asistente. Qutai muestra cada estilo y cada ' +
  'script que escribe el asistente y solo lo ejecuta después de que usted lo apruebe, y los scripts importados ' +
  'siguen desactivados hasta que usted los apruebe. Los estilos y los scripts solo se ejecutan en las páginas que ' +
  'usted abre, en su teléfono. Qutai rechaza parte del código de riesgo, pero no revisa el código que usted ' +
  'escribe, edita o importa, y no puede garantizar lo que hace ningún código: un script se ejecuta con su sesión ' +
  'iniciada en ese sitio, puede cambiar la página o hacer que deje de funcionar, y puede afectar a su cuenta en él. ' +
  'Apruebe solo lo que entienda y le merezca confianza. Usted es responsable de los estilos y scripts que aprueba, ' +
  'guarda, importa o comparte.';

const APPS_BODY =
  'Las apps dentro de Qutai las escribe la IA a petición suya. Se ejecutan aisladas de internet y de los sitios ' +
  'web, pero no las probamos ni revisamos y se ofrecen sin garantía: una app puede tener errores o perder los ' +
  'datos guardados en ella, así que exporte o haga una copia de seguridad de todo lo importante. Las apps que ' +
  'importa desde un archivo pueden venir de cualquier persona y no las revisamos; Qutai le muestra qué es una app ' +
  'importada y qué puede usar antes de que usted la active. Usted es responsable de las apps que activa y de las ' +
  'que comparte con otras personas.';

const DOWNLOADS_BODY =
  'Usted decide qué descargar, abrir e instalar. Qutai le avisa antes de descargar archivos que pueden instalar o ' +
  'ejecutar código, pero no analiza los archivos en busca de virus u otros daños. En Android, abrir una app ' +
  'descargada (un archivo APK) la entrega al instalador del sistema; Qutai nunca instala nada por sí mismo. Los ' +
  'archivos y apps de fuera de App Store y Google Play pueden dañar su teléfono o sus datos; descargarlos, abrirlos ' +
  'e instalarlos es responsabilidad suya, al igual que tener derecho a hacerlo.';

const ACCEPTABLE_USE_BULLETS =
  '• infringir la ley o los derechos de otras personas, como su privacidad, sus derechos de autor o sus marcas;\n' +
  '• incumplir las condiciones de los sitios web o de los proveedores de IA;\n' +
  '• eludir contraseñas, controles de acceso, muros de pago, protecciones anticopia (DRM) u otras protecciones ' +
  'técnicas;\n' +
  '• recopilar, rastrear o publicar de forma ilícita datos personales de otras personas;\n' +
  '• enviar spam, crear cuentas o reseñas falsas, publicar o actuar de forma masiva y automatizada, o sobrecargar ' +
  'sitios web;\n' +
  '• engañar o estafar a nadie, ni propagar malware';

const WARRANTY_BODY =
  'Qutai se proporciona «tal cual» y «según disponibilidad». Trabajamos para que sea útil y seguro, pero no ' +
  'prometemos que funcione siempre, que esté libre de errores, que bloquee lo que usted espera ni que funcione con ' +
  'todos los sitios web, y no damos más garantías que las que exige la ley. En la medida en que la ley lo permita, ' +
  'no somos responsables de las pérdidas causadas por los sitios web y su contenido, por otras personas, por los ' +
  'servicios de los proveedores de IA, por las listas de filtros, por los estilos, scripts y apps que usted aprueba ' +
  'o importa, ni por las acciones que pidió o aprobó, ni de las pérdidas indirectas, como el lucro cesante. Nada ' +
  'en estas condiciones limita la responsabilidad por dolo o culpa grave, por muerte o lesiones personales, ni ' +
  'ninguna otra responsabilidad que la ley no permita limitar o excluir.';

const CONSUMER_BODY =
  'Si usa Qutai como consumidor, conserva todos los derechos que la ley del lugar donde vive otorga a los ' +
  'consumidores y que no pueden excluirse por contrato, como sus derechos según la legislación turca de consumo ' +
  '(Ley n.º 6502 de Protección del Consumidor) y la legislación de consumo de la Unión Europea y del Espacio ' +
  'Económico Europeo. Nada en estas condiciones limita ni excluye esos derechos; si una condición entra en ' +
  'conflicto con ellos, prevalecen esos derechos.';

/** The terms sections both builds share, from "Qutai is a browser" to "Changes", around Acceptable use. */
function sharedTerms(acceptableUse: string) {
  return [
    { heading: 'Qutai es un navegador', body: BROWSER_BODY },
    { heading: 'El asistente actúa en su nombre', body: ASSISTANT_BODY },
    { heading: 'Respuestas de la IA', body: AI_ANSWERS_BODY },
    { heading: 'Bloqueo de anuncios y rastreadores', body: BLOCKING_TERMS_BODY },
    { heading: 'Estilos de página y scripts', body: STYLES_BODY },
    { heading: 'Apps dentro de Qutai', body: APPS_BODY },
    { heading: 'Descargas e instalación de archivos', body: DOWNLOADS_BODY },
    { heading: 'Uso aceptable', body: acceptableUse },
    { heading: 'Sin garantía y límites de responsabilidad', body: WARRANTY_BODY },
    { heading: 'Sus derechos como consumidor', body: CONSUMER_BODY },
    { heading: 'Cambios', body: TERMS_CHANGES },
  ];
}

export const es: LegalTranslation = {
  openSource: {
    privacy: {
      title: 'Política de privacidad',
      intro:
        'Qutai es un navegador web con un asistente de IA. Lo creamos para que su navegación se quede en su ' +
        'teléfono. Qutai no tiene servidores propios: no recopilamos, almacenamos ni vendemos sus datos.',
      sections: [
        {
          heading: 'Lo que se queda en su teléfono',
          body:
            'Sus pestañas, historial, marcadores, páginas guardadas, descargas, permisos de sitios, la memoria del ' +
            'asistente (incluidas sus respuestas a las preguntas opcionales de la configuración inicial y el ' +
            'formulario de dirección), sus instrucciones personalizadas, el historial de acciones del asistente y ' +
            'sus conversaciones se almacenan solo en este dispositivo. Las claves de API se guardan en el ' +
            'almacenamiento cifrado del teléfono. Las pestañas de incógnito no guardan nada en el teléfono, salvo los archivos que usted ' +
            'descargue desde ellas; sus conversaciones no se guardan.',
        },
        {
          heading: 'Lo que sale de su teléfono y a quién',
          body:
            BULLET_WEBSITES +
            '• Cuando usa el asistente, cada solicitud va con su propia clave de API al servicio de IA que usted ' +
            'configuró: directamente a Anthropic, OpenAI o Google; a OpenRouter, que la transmite al proveedor del ' +
            'modelo que eligió; o a un servidor compatible con OpenAI cuya dirección usted escribió. Una solicitud ' +
            'contiene su mensaje, la conversación hasta ese momento, el contenido que necesita el asistente (el ' +
            'texto de la página, capturas de pantalla cuando mira una página, los archivos e imágenes que usted ' +
            'adjunta, el resultado de un script que aprobó en una página y, cuando pregunta por las cookies, sus ' +
            'nombres, sitios y ajustes, nunca sus valores), sus instrucciones personalizadas y, mientras la memoria ' +
            'está activada, sus recuerdos (los recuerdos ocultos, como los números de identificación, solo como una ' +
            'etiqueta). Sus eventos del calendario y su ubicación se envían solo cuando usted lo confirma, cada ' +
            'vez, salvo que haya elegido «No volver a preguntar» para ellos (puede deshacerlo en ' +
            'Configuración › Asistente › «Permitido sin preguntar»); en las conversaciones con ' +
            'pestañas de incógnito nunca se usan. ' +
            'Si la búsqueda web está activada, el servicio puede hacer búsquedas por usted. La política de ' +
            'privacidad y las condiciones de ese servicio se aplican a estos datos.\n' +
            BULLETS_COMMON +
            '\n' +
            'No se envía nada más: Qutai no tiene analítica, seguimiento ni publicidad.',
        },
        {
          heading: 'Sus contactos',
          body: CONTACTS_BODY,
        },
        {
          heading: BLOCKING_HEADING,
          body: BLOCKING_PRIVACY_OPEN_SOURCE,
        },
        {
          heading: 'Contraseñas y datos de pago',
          body: PASSWORDS_BODY,
        },
        {
          heading: 'Su control',
          body:
            'Puede ver y eliminar la memoria del asistente, borrar el historial, las cookies y otros datos en ' +
            'Configuración, y quitar sus claves de API en cualquier momento. Desinstalar Qutai elimina todo lo que almacenó, salvo los archivos que usted guardó fuera ' +
            'de la app, como las descargas en la carpeta Descargas de Android y las imágenes guardadas ' +
            'en sus Fotos.',
        },
        {
          heading: 'Menores',
          body: 'Qutai no está dirigido a menores de 13 años.',
        },
        {
          heading: 'Cambios',
          body: POLICY_CHANGES,
        },
      ],
    },
    terms: {
      title: 'Condiciones de uso',
      intro: TERMS_INTRO,
      sections: [
        {
          heading: 'Su proveedor de IA y los costos',
          body:
            'El asistente funciona con su propia clave de API de Anthropic, OpenAI, Google u OpenRouter, o con un ' +
            'servidor compatible con OpenAI que usted configure. Usarlo es un acuerdo entre usted y ese servicio: se ' +
            'aplican sus condiciones, su política de privacidad y sus precios, y usted es responsable de su cuenta en ' +
            'él y de todos los costos que se cobren a su clave. ' +
            NOT_A_PARTY,
        },
        ...sharedTerms(
          'No use Qutai, el asistente, los estilos, los scripts ni las apps para:\n' + ACCEPTABLE_USE_BULLETS + '.',
        ),
      ],
    },
  },
  pro: {
    privacy: {
      title: 'Política de privacidad',
      intro:
        'Qutai es un navegador web con un asistente de IA. Lo creamos para que su navegación se quede en su ' +
        'teléfono. El servidor propio de Qutai se usa solo para su cuenta de Qutai (inicio de sesión, Qutai Credits, ' +
        'compras en la app y copias de seguridad), y solo cuando usted los elige. No vendemos sus datos, y Qutai no ' +
        'tiene analítica, seguimiento ni publicidad.',
      sections: [
        {
          heading: 'Quiénes somos',
          body:
            'Qutai está hecho por Osman Yuksel («nosotros»), que es el responsable del tratamiento de los datos ' +
            'descritos en esta política. Para preguntas sobre su privacidad, o para solicitar una copia o la ' +
            'supresión de lo que el servidor de Qutai guarda sobre usted, escriba a qutai@sonsuzdongu.com.',
        },
        {
          heading: 'Lo que se queda en su teléfono',
          body:
            'Sus pestañas, historial, marcadores, páginas guardadas, descargas, permisos de sitios, la memoria del ' +
            'asistente, su historial de acciones y sus conversaciones se almacenan solo en este dispositivo, también ' +
            'cuando ha iniciado sesión, salvo que haga una copia de seguridad de ellos en su cuenta de Qutai (véase ' +
            'más abajo). Las claves de API y su inicio de sesión se guardan en el almacenamiento cifrado del ' +
            'teléfono. Las pestañas de incógnito no guardan nada en el teléfono, salvo los archivos que usted ' +
            'descargue desde ellas; sus conversaciones no se guardan.',
        },
        {
          heading: 'Lo que sale de su teléfono y a quién',
          body:
            BULLET_WEBSITES +
            '• Con su propia clave de API, su mensaje y el contenido que necesita el asistente (el texto de la ' +
            'página, capturas de pantalla cuando mira una página, los archivos e imágenes que usted adjunta, el ' +
            'resultado de un script que aprobó en una página, cuando pregunta por las cookies sus nombres, sitios y ' +
            'ajustes pero nunca sus valores, su memoria y sus instrucciones personalizadas) van directamente al ' +
            'proveedor de IA que eligió (Anthropic, OpenAI, Google, OpenRouter o su propio servidor). El servidor de ' +
            'Qutai no interviene. Sus eventos del calendario y su ubicación se envían solo cuando usted lo confirma, cada ' +
            'vez, salvo que haya elegido «No volver a preguntar» para ellos (puede deshacerlo en ' +
            'Configuración › Asistente › «Permitido sin preguntar»); en las conversaciones con ' +
            'pestañas de incógnito nunca se usan.\n' +
            '• Con Qutai Credits, el mismo contenido va primero al servidor de Qutai, que lo transmite al proveedor ' +
            'de IA (Anthropic, OpenAI o Google) con la propia cuenta de Qutai y le devuelve la respuesta. El ' +
            'servidor de Qutai no almacena ni registra este contenido. La app le pregunta antes de que use Qutai ' +
            'Credits por primera vez.\n' +
            '• Si la búsqueda web está activada, el proveedor de IA puede hacer búsquedas por usted. Las políticas ' +
            'de privacidad y las condiciones de los proveedores se aplican a lo que reciben.\n' +
            BULLETS_COMMON +
            '\n• Si denuncia una respuesta o una app (⋮ › Denunciar), la denuncia va al servidor de Qutai: el motivo, su nota, el texto de la respuesta o el nombre y el código de la app solo si deja marcada la casilla «Incluir», si la respuesta vino de Qutai Credits o de su propia clave, la versión de la app, el sistema del teléfono y el idioma de la app, y su cuenta si ha iniciado sesión. Las denuncias se guardan 180 días y solo se usan para encontrar y corregir respuestas y apps dañinas.',
        },
        {
          heading: 'Su cuenta de Qutai',
          body:
            'La cuenta es opcional; solo la necesita para Qutai Credits, las compras en la app y las copias de ' +
            'seguridad en su cuenta. Usted inicia sesión con Apple, con Google o con su dirección de correo ' +
            'electrónico. Con el correo electrónico, enviamos a la dirección que usted introduce un mensaje con un ' +
            'código de un solo uso y un enlace, a través de nuestro servicio de correo electrónico (Mailjet); el ' +
            'código es válido durante 10 minutos y solo en el teléfono que lo solicitó y, para evitar abusos, el ' +
            'servidor cuenta cuántos códigos se envían a cada dirección y a cada teléfono. El servidor de Qutai ' +
            'guarda: un número de cuenta; los métodos de inicio de sesión que tiene la cuenta (Apple, Google, correo ' +
            'electrónico) y las direcciones de correo electrónico asociadas a ellos (con Apple puede ser una ' +
            'dirección de reenvío privada); cuándo se creó la cuenta y cuándo se usó por última vez; sus ' +
            'dispositivos con sesión iniciada (un identificador de dispositivo aleatorio, no los identificadores de ' +
            'su teléfono); y sus créditos: el saldo, las compras y los créditos agregados y, para cada solicitud al ' +
            'asistente, el modelo, el número de tokens, lo que costó y cuándo. No guarda sus mensajes, páginas ni ' +
            'respuestas.',
        },
        {
          heading: 'Copias de seguridad en su cuenta de Qutai',
          body:
            'Solo si usted lo elige (Configuración › Copia de seguridad), el servidor de Qutai guarda su archivo de ' +
            'copia de seguridad: los mismos datos que una copia de seguridad que usted exporta (marcadores, ' +
            'historial, la memoria del asistente, tareas guardadas, ajustes de sitios y preferencias; pestañas ' +
            'abiertas, conversaciones, actividad y claves de IA solo si usted las incluye). Antes de enviarse, se ' +
            'cifra en su teléfono con una contraseña que usted elige; Qutai no puede leerlo ni recuperar la ' +
            'contraseña, que se guarda solo en su teléfono. Con cada copia de seguridad, el servidor también guarda ' +
            'cuándo se hizo, su tamaño, la versión de la app y el tipo de teléfono (por ejemplo, «iPhone · iOS 26»). ' +
            'Se conservan las copias de seguridad más recientes (3 en la actualidad) y las más antiguas se eliminan; ' +
            'usted puede eliminarlas en cualquier momento, y al eliminar su cuenta se eliminan.',
        },
        {
          heading: 'Compras en la app',
          body:
            'Qutai Credits y cualquier otra cosa que se venda en la app se compran a través de App Store o Google ' +
            'Play; sus datos de pago se quedan con Apple o Google y nunca llegan a Qutai. Un servicio de pagos ' +
            '(RevenueCat) recibe su número de cuenta de Qutai y el registro de compra de la tienda para que la ' +
            'compra pueda confirmarse, agregarse a su cuenta y restaurarse en otro teléfono. Qutai guarda un ' +
            'registro de cada compra (tienda, transacción, producto, créditos, precio pagado y fechas), que la ' +
            'legislación tributaria nos obliga a conservar, también después de que se elimine la cuenta, sin el ' +
            'vínculo con usted. Los reembolsos los gestionan Apple o Google según sus propias normas.',
        },
        {
          heading: 'El servidor de Qutai y quién más trata datos',
          body:
            'El servidor de Qutai funciona en Cloudflare, que también almacena las copias de seguridad. Como ' +
            'cualquier servidor, ve su dirección IP con cada solicitud; la usa solo para limitar cuántas solicitudes ' +
            'se pueden hacer, y los registros propios de Qutai nunca contienen su dirección IP, su dirección de ' +
            'correo electrónico, sus mensajes, páginas ni tokens de inicio de sesión (contienen un identificador de ' +
            'solicitud, su número de cuenta, lo que se solicitó, cuánto tardó y, para las solicitudes al asistente, ' +
            'el modelo, los tokens y el costo). Las empresas que tratan datos por cuenta de Qutai, ' +
            'cada una conforme a su propia política de privacidad, son: Cloudflare (el servidor), ' +
            'Apple y Google (el inicio de sesión y las tiendas), Mailjet (los correos de inicio de sesión), ' +
            'RevenueCat (las compras) y, con Qutai Credits, Anthropic, OpenAI y Google (la IA). No compartimos sus ' +
            'datos con nadie más, salvo cuando la ley lo exige (por ejemplo, una orden judicial) o para proteger a ' +
            'Qutai y a sus usuarios contra el fraude y el abuso.',
        },
        {
          heading: 'Plazo de conservación de los datos',
          body:
            'En su teléfono: hasta que usted los elimine o desinstale Qutai. En el servidor de Qutai: su cuenta, ' +
            'sus métodos de inicio de sesión, dispositivos e historial de créditos, hasta que elimine la cuenta; las ' +
            'copias de seguridad, como se describe arriba; los códigos de inicio de sesión, hasta que se usen o ' +
            'caduquen; los registros de compra, durante el tiempo que exija la legislación tributaria, sin el ' +
            'vínculo con usted una vez eliminada la cuenta.',
        },
        {
          heading: 'Sus contactos',
          body: CONTACTS_BODY,
        },
        {
          heading: BLOCKING_HEADING,
          body: BLOCKING_PRIVACY_PRO,
        },
        {
          heading: 'Contraseñas y datos de pago',
          body: PASSWORDS_BODY,
        },
        {
          heading: 'Su control',
          body:
            'Puede ver y eliminar la memoria del asistente, borrar el historial, las cookies y otros datos en ' +
            'Configuración, y quitar sus claves de API en cualquier momento. Puede eliminar sus copias de seguridad ' +
            'del servidor de Qutai en Configuración › Copia de seguridad. Puede dejar de usar Qutai Credits, cerrar ' +
            'sesión o eliminar su cuenta en Configuración › Cuenta: al eliminarla se borran la cuenta, su saldo y su ' +
            'historial del servidor de Qutai (los registros de compra se conservan sin el vínculo con usted, como se ' +
            'indica arriba) y se pide al servicio de pagos que elimine su registro sobre usted. También puede ' +
            'escribir a qutai@sonsuzdongu.com para solicitar una copia de lo que el servidor de Qutai guarda sobre ' +
            'usted, o su rectificación o supresión. Desinstalar Qutai elimina todo lo que almacenó en el teléfono, salvo los archivos que ' +
            'usted guardó fuera de la app, como las descargas en la carpeta Descargas de Android y las ' +
            'imágenes guardadas en sus Fotos.',
        },
        {
          heading: 'Seguridad',
          body:
            'Las conexiones con el servidor de Qutai usan HTTPS. Los tokens de inicio de sesión se guardan en el ' +
            'servidor solo en forma de hash y en su teléfono en su almacenamiento cifrado, y las copias de seguridad ' +
            'se cifran en su teléfono antes de enviarse.',
        },
        {
          heading: 'Menores',
          body:
            'Qutai no está dirigido a menores de 13 años, y no recopilamos a sabiendas datos de ellos. En algunos ' +
            'países usted debe tener más edad (por ejemplo, 16 años) para dar por sí mismo su consentimiento a esta ' +
            'política; por debajo de esa edad, debe darlo por usted su padre, su madre o su tutor legal.',
        },
        {
          heading: 'Cambios',
          body: POLICY_CHANGES,
        },
      ],
    },
    terms: {
      title: 'Condiciones de uso',
      intro: TERMS_INTRO,
      sections: [
        {
          heading: 'Dos formas de usar el asistente',
          body:
            '• Su propia clave de API: usarla es un acuerdo entre usted y ese proveedor. Se aplican sus condiciones, ' +
            'su política de privacidad y sus precios, y usted es responsable de su cuenta en él y de todos los costos ' +
            'que se cobren a su clave; ' +
            NOT_A_PARTY +
            '\n' +
            '• Qutai Credits: las solicitudes del asistente pasan por el servidor de Qutai y se pagan con créditos ' +
            'de su cuenta de Qutai. Necesita una cuenta para usarlos.',
        },
        {
          heading: 'Qutai Credits',
          body:
            'Los créditos se compran en la app a través de App Store o Google Play, al precio que muestra la tienda, ' +
            'y se agregan a su cuenta de Qutai una vez confirmada la compra. Solo sirven para pagar las solicitudes ' +
            'del asistente en Qutai, a los precios en créditos indicados para cada modelo; lo que costó cada ' +
            'respuesta se muestra debajo de ella. Una solicitud primero reserva lo máximo que podría costar y ' +
            'devuelve lo que no usó. Los créditos pertenecen a su cuenta de Qutai, pueden usarse en cualquier ' +
            'teléfono en el que usted inicie sesión, no pueden transferirse ni canjearse por dinero y no se ' +
            'reembolsan, salvo cuando lo exijan la ley o las normas de reembolso de la tienda; los reembolsos los ' +
            'gestionan Apple o Google. Si se reembolsa una compra, sus créditos se retiran, lo que puede dejar el ' +
            'saldo en negativo hasta que usted lo recargue. Los créditos no caducan. Los modelos, los precios en créditos y los límites ' +
            'pueden cambiar; los vigentes se muestran en la app antes de que usted los use. Qutai Credits puede ' +
            'pausarse por mantenimiento o no estar disponible en algunos momentos.',
        },
        {
          heading: 'Su cuenta',
          body:
            'Mantenga seguro su inicio de sesión (Apple, Google o su correo electrónico); lo que se haga con su ' +
            'cuenta es su responsabilidad. Podemos suspender una cuenta que incumpla estas condiciones. Si elimina ' +
            'su cuenta, se pierden los créditos que le queden.',
        },
        ...sharedTerms(
          'No use Qutai, Qutai Credits, el asistente, los estilos, los scripts ni las apps para:\n' +
            ACCEPTABLE_USE_BULLETS +
            ';\n' +
            '• hacer un uso indebido del servidor de Qutai, atacarlo o sobrecargarlo.\n' +
            'Podemos suspender una cuenta que se use de estas formas.',
        ),
      ],
    },
  },
};
