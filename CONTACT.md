# Envío de recomendaciones

El formulario utiliza FormSubmit mediante un POST HTML nativo. El destinatario se indica en el atributo action de guest-form en index.html y se muestra en la página con autorización del usuario. No requiere claves de API.

El primer envío requiere que el destinatario confirme el formulario mediante el mensaje de activación recibido en su buzón. Revisar también correo no deseado. Seguir las instrucciones del servicio y volver a realizar la prueba después de activar. No se considera entrega confirmada una navegación, una respuesta HTTP exitosa o una simulación: revisar el resultado del servicio y confirmar recepción en el buzón.

Se conserva la verificación contra spam del proveedor. El formulario lleva al visitante a FormSubmit para completar el envío; no se muestran confirmaciones de entrega locales. El envío funciona también sin JavaScript.

Las pruebas desde el entorno requieren permitir formsubmit.co en la configuración de red. Guardar un borrador de red no aplica automáticamente la configuración a la máquina en ejecución.
